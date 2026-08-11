#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
xlsx_to_json.py
================
يحوّل ملف نتائج البكالوريا بصيغة xlsx إلى results.json
بنفس البنية التي يتوقعها app.js (فهرسة بالقواميس لتصغير حجم الملف).

الاستخدام:
    python3 xlsx_to_json.py input.xlsx output.json

أعمدة ملف الإكسل المتوقعة (أسماء الرؤوس في الصف الأول):
    noreg        رقم التسجيل (اختياري، رقم تسلسلي)on
    wilayaFr     الولاية بالفرنسية
    wilayaAr     الولاية بالعربية
    centreFr     مركز الامتحان بالفرنسية
    centreAr     مركز الامتحان بالعربية
    etabFr       المؤسسة بالفرنسية
    etabAr       المؤسسة بالعربية
    numbac       رقم الباكالوريا
    serieCode    رمز الشعبة (SN, LM, LO, M, LA, TS, TM ...)
    serieFr      الشعبة بالفرنسية
    serieAr      الشعبة بالعربية
    nomFr        الاسم الكامل بالفرنسية
    nomAr        الاسم الكامل بالعربية
    lieuFr       مكان الازدياد بالفرنسية
    lieuAr       مكان الازدياد بالعربية
    moy          المعدل العام
    decision     القرار (Admis, Ajourné, Sessionnaire, Absent, ...)

يمكن أن تختلف أسماء الرؤوس قليلاً (حروف كبيرة/صغيرة، مسافات، فواصل سفلية) —
السكربت يحاول مطابقتها تلقائيًا عبر HEADER_ALIASES أدناه. إن لم يجد عمودًا
مطلوبًا سيوقفك برسالة واضحة تخبرك بالعمود الناقص.
"""

import sys
import json
import unicodedata
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------- #
# 1) خرائط أسماء الأعمدة البديلة -> الاسم الداخلي الموحّد
#    عدّل هذه القوائم إن كانت رؤوس أعمدة ملفك مختلفة.
# ---------------------------------------------------------------- #
HEADER_ALIASES = {
    "noreg":     ["noreg", "no_reg", "no reg", "num", "n°", "nodoss", "no_doss", "n° dossier", "numero dossier"],
    "wilayaFr":  ["wilayafr", "wilaya_fr", "wilaya fr", "wilaya"],
    "wilayaAr":  ["wilayaar", "wilaya_ar", "wilaya ar", "الولاية"],
    "centreFr":  ["centrefr", "centre_fr", "centre fr", "centre", "centre examen_fr", "centre examen fr"],
    "centreAr":  ["centrear", "centre_ar", "centre ar", "مركز الامتحان", "المركز", "centre examen_ar", "centre examen ar"],
    "etabFr":    ["etabfr", "etab_fr", "etab fr", "etab", "etablissement", "etablissement_fr"],
    "etabAr":    ["etabar", "etab_ar", "etab ar", "المؤسسة", "etablissement_ar"],
    "numbac":    ["numbac", "num_bac", "num bac", "رقم الباكالوريا", "رقم البكالوريا", "nodoss", "no_doss", "n° dossier"],
    "serieCode": ["seriecode", "serie_code", "serie code", "code_serie", "code serie", "serie"],
    "serieFr":   ["seriefr", "serie_fr", "serie fr"],
    "serieAr":   ["seriear", "serie_ar", "serie ar", "الشعبة"],
    "nomFr":     ["nomfr", "nom_fr", "nom fr", "nom"],
    "nomAr":     ["nomar", "nom_ar", "nom ar", "الاسم"],
    "lieuFr":    ["lieufr", "lieu_fr", "lieu fr", "lieu", "lieun_fr", "lieun fr"],
    "lieuAr":    ["lieuar", "lieu_ar", "lieu ar", "مكان الازدياد", "lieunn_ar", "lieunn ar"],
    "moy":       ["moy", "moyenne", "المعدل", "moy bac_session", "moy bac session", "moy_bac_session"],
    "decision":  ["decision", "décision", "القرار"],
}

# ملاحظة: numbac و noreg قد يتشاركان نفس عمود المصدر (مثلاً NODOSS) في بعض
# الملفات — هذا مقصود، السكربت يملأ العمودين من نفس المصدر إذا لم يوجد كل
# منهما على حدة.

REQUIRED = [
    "wilayaFr", "wilayaAr", "centreFr", "centreAr", "etabFr", "etabAr",
    "numbac", "serieCode", "nomFr", "nomAr",
    "lieuFr", "lieuAr", "moy", "decision",
]

# جدول تحويل رمز الشعبة -> (بالفرنسية، بالعربية)، يُستعمل فقط إذا كان
# ملف الإكسل لا يحتوي على عمودي serieFr / serieAr صراحة.
SERIE_CODE_TABLE = {
    "SN": ("Sciences Naturelles", "العلوم الطبيعية"),
    "LM": ("Lettres Modernes", "الآداب العصرية"),
    "LO": ("Lettres Originelles", "الآداب الأصلية"),
    "M":  ("Mathematiques", "الرياضيات"),
    "LA": ("Lettres Langues", "الآداب اللغات"),
    "TS": ("T S G E", "T S G E"),
    "TM": ("T M G M", "T M G M"),
}


def norm_header(h: str) -> str:
    h = unicodedata.normalize("NFKC", str(h)).strip().lower()
    return h


def build_column_map(df_columns):
    """يطابق أعمدة الملف الفعلية مع الأسماء الداخلية الموحّدة."""
    lookup = {}
    for actual in df_columns:
        lookup[norm_header(actual)] = actual

    resolved = {}
    missing = []
    for internal, aliases in HEADER_ALIASES.items():
        found = None
        for alias in aliases:
            if alias in lookup:
                found = lookup[alias]
                break
        if found is not None:
            resolved[internal] = found
        elif internal in REQUIRED:
            missing.append(internal)

    if missing:
        actual_list = ", ".join(str(c) for c in df_columns)
        raise SystemExit(
            "تعذّر إيجاد الأعمدة التالية في ملف الإكسل: "
            + ", ".join(missing)
            + "\nأعمدة الملف الموجودة فعليًا: "
            + actual_list
            + "\n\nعدّل HEADER_ALIASES في أعلى السكربت لإضافة اسم العمود الصحيح."
        )
    return resolved


class DictIndex:
    """يبني قائمة قيم فريدة ويعيد فهرس كل قيمة (لضغط الملف)."""

    def __init__(self):
        self._index = {}
        self._values = []

    def get(self, key_tuple):
        if key_tuple not in self._index:
            self._index[key_tuple] = len(self._values)
            self._values.append(list(key_tuple))
        return self._index[key_tuple]

    @property
    def values(self):
        return self._values


def to_str(v):
    if pd.isna(v):
        return ""
    return str(v).strip()


def to_num(v):
    if pd.isna(v):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def convert(input_path: Path, output_path: Path):
    print(f"جارٍ قراءة {input_path} ...")
    df = pd.read_excel("data/RESULTATS_BAC_SC_2025_7072_Ap_CT.xlsx")  # كل شيء كنص أولًا، نحوّل moy لاحقًا
    print(f"عدد الصفوف: {len(df)}")

    colmap = build_column_map(df.columns)

    wilaya_idx = DictIndex()
    centre_idx = DictIndex()
    etab_idx = DictIndex()
    serie_idx = DictIndex()
    lieu_idx = DictIndex()
    decision_idx = DictIndex()

    rows = []
    skipped = 0

    for i, row in df.iterrows():
        numbac = to_str(row[colmap["numbac"]])
        if not numbac:
            skipped += 1
            continue

        wilaya_i = wilaya_idx.get((to_str(row[colmap["wilayaFr"]]), to_str(row[colmap["wilayaAr"]])))
        centre_i = centre_idx.get((to_str(row[colmap["centreFr"]]), to_str(row[colmap["centreAr"]])))
        etab_i = etab_idx.get((to_str(row[colmap["etabFr"]]), to_str(row[colmap["etabAr"]])))

        code = to_str(row[colmap["serieCode"]])
        if "serieFr" in colmap and "serieAr" in colmap:
            serie_fr = to_str(row[colmap["serieFr"]])
            serie_ar = to_str(row[colmap["serieAr"]])
        else:
            serie_fr, serie_ar = SERIE_CODE_TABLE.get(code.upper(), (code, code))
        serie_i = serie_idx.get((code, serie_fr, serie_ar))

        lieu_i = lieu_idx.get((to_str(row[colmap["lieuFr"]]), to_str(row[colmap["lieuAr"]])))
        decision_i = decision_idx.get((to_str(row[colmap["decision"]]),))

        if "noreg" in colmap:
            noreg = to_str(row[colmap["noreg"]])
        else:
            noreg = str(i + 1)
        try:
            noreg = int(noreg)
        except ValueError:
            noreg = i + 1

        moy = to_num(row[colmap["moy"]])

        rows.append([
            noreg,
            wilaya_i,
            centre_i,
            etab_i,
            numbac,
            serie_i,
            to_str(row[colmap["nomFr"]]),
            to_str(row[colmap["nomAr"]]),
            lieu_i,
            moy,
            decision_i,
        ])

    # decision في القاموس النهائي يجب أن تكون سلسلة نصية واحدة لا مصفوفة
    # (لأن app.js يستعمل dicts.decision.indexOf("Admis") ويقرأ dicts.decision[i] كسلسلة)
    decision_values_flat = [v[0] for v in decision_idx.values]

    payload = {
        "dicts": {
            "wilaya": wilaya_idx.values,
            "centre": centre_idx.values,
            "etab": etab_idx.values,
            "serie": serie_idx.values,
            "lieu": lieu_idx.values,
            "decision": decision_values_flat,
        },
        "cols": ["noreg", "wilaya", "centre", "etab", "numbac", "serie",
                 "nomFr", "nomAr", "lieu", "moy", "decision"],
        "rows": rows,
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"تم إنشاء {output_path}")
    print(f"  - عدد النتائج المحوّلة: {len(rows)}")
    if skipped:
        print(f"  - عدد الصفوف المتجاهلة (بدون رقم باكالوريا): {skipped}")
    print(f"  - عدد الولايات: {len(wilaya_idx.values)}")
    print(f"  - عدد مراكز الامتحان: {len(centre_idx.values)}")
    print(f"  - عدد المؤسسات: {len(etab_idx.values)}")
    print(f"  - عدد الشعب: {len(serie_idx.values)}")
    print(f"  - عدد أماكن الازدياد: {len(lieu_idx.values)}")
    print(f"  - القرارات: {decision_values_flat}")


def main():
    if len(sys.argv) != 3:
        print("الاستخدام: python3 xlsx_to_json.py input.xlsx output.json")
        sys.exit(1)
    convert(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
