# بوابة نتائج البكالوريا 2026 — الدورة العادية

موقع استعلام ثابت (Static Site) يعرض نتائج امتحان شهادة البكالوريا لعام 2026،
اعتمادًا على ملف Excel المزوَّد بعد حذف عمود تاريخ الميلاد لحماية خصوصية المترشحين.

## هيكل المشروع

```
results-system/
├── index.html          الصفحة الرئيسية (نموذج البحث + بطاقة النتيجة + ترتيب المترشح)
├── top.html             صفحة "🏆 الأوائل": أفضل 3 طلاب وطنيًا في كل شعبة
├── css/style.css        التنسيق الكامل (تصميم بروح "الختم الرسمي")
├── js/app.js             منطق التحميل والبحث والعرض وحساب الترتيب لصفحة النتيجة
├── js/top.js             منطق تحميل نفس البيانات وحساب/عرض قائمة الأوائل
├── data/
│   ├── results.xlsx      الملف المصدر (بعد حذف عمود تاريخ الميلاد)
│   └── results.json      نسخة مضغوطة ومُفهرَسة من نفس البيانات، يقرأها app.js وtop.js فعليًا
├── assets/logo.png       شعار أصلي (ختم دائري) لا يمثّل أي رمز رسمي حقيقي
└── README.md
```

## الترتيب (رتبة المترشح) وصفحة الأوائل

- تُحسب أربع رتب لكل مترشح **ناجح** (`Admis`) ضمن **نفس شعبته**: الترتيب الوطني،
  ترتيب الولاية، ترتيب مركز الامتحان، وترتيب المؤسسة — وتُعرض داخل بطاقة النتيجة
  بصيغة "الرتبة من إجمالي الناجحين في نفس النطاق والشعبة".
- المترشحون غير الناجحين (غير `Admis`) لا يُعرض لهم أي ترتيب.
- عند تساوي المعدل بين عدة مترشحين، يحصلون على نفس الرتبة (ترتيب تنافسي قياسي:
  1، 1، 3 وليس 1، 1، 2).
- صفحة `top.html` تعرض أفضل 3 طلاب وطنيًا في كل شعبة من بين الناجحين، مرتّبين
  حسب المعدل تنازليًا.
- **كل هذا الحساب يتم بالكامل داخل المتصفح (JavaScript) من نفس `results.json`
  الموجود أصلًا** — لا يتطلب أي تعديل على سكربت التوليد ولا على الكود عند رفع
  ملف نتائج سنة جديدة؛ يكفي استبدال `results.xlsx` وإعادة توليد `results.json`
  كالمعتاد (انظر قسم "تحديث البيانات مستقبلًا" أدناه) وسيُعاد حساب كل الرتب
  وقائمة الأوائل تلقائيًا من البيانات الجديدة.

## كيف تعمل البيانات

المتصفح لا يقرأ `results.xlsx` مباشرة (تحليل ملف Excel داخل المتصفح لأكثر من
64 ألف صف يكون بطيئًا ويتطلّب مكتبة خارجية عبر الإنترنت). بدلًا من ذلك:

- `data/results.json` نسخة "مفهرسة" (dictionary-encoded) من نفس البيانات:
  الأعمدة المتكررة كثيرًا (الولاية، مركز الامتحان، المؤسسة، الشعبة، مكان الميلاد،
  القرار) تُخزَّن مرة واحدة في قائمة، وكل صف يشير إليها برقم فهرس بدل تكرار النص.
  هذا يقلّص الحجم من نحو 20 م.ب إلى نحو 6.5 م.ب (وأقل من 2 م.ب بعد ضغط gzip
  الذي تفعّله أغلب الخوادم الثابتة تلقائيًا مثل GitHub Pages أو Netlify).
- إن عدّلت بيانات `results.xlsx` مستقبلًا، أعد توليد `results.json` بنفس الطريقة
  (سكربت بسيط بـ pandas يبني القاموس ويكتب JSON) — راجع قسم "تحديث البيانات" أدناه.

## التشغيل محليًا

لا حاجة لأي تثبيت. من داخل مجلد `results-system`:

```bash
python3 -m http.server 8000
```

ثم افتح `http://localhost:8000` في المتصفح.

> **ملاحظة:** فتح `index.html` مباشرة بنقرتين (بروتوكول `file://`) لن يعمل، لأن
> المتصفحات تمنع `fetch()` لملفات محلية بدون خادم. استخدم أمر التشغيل أعلاه، أو
> ارفع المجلد على أي استضافة ثابتة.

## النشر

المشروع ثابت بالكامل (HTML/CSS/JS + بيانات JSON)، فيمكن نشره مباشرة على:
GitHub Pages، Netlify، Vercel، Cloudflare Pages، أو أي خادم ويب عادي — يكفي رفع
محتوى المجلد كما هو.

## البحث المتاح

- **برقم الباكالوريا (`Num_Bac`)**: تطابق فوري ودقيق.
- **بالاسم الكامل**: بحث تقريبي (يتجاهل الفروق بين أ/إ/آ، ة/ه، ى/ي) بالعربية أو
  الفرنسية؛ إن تعددت النتائج تظهر قائمة للاختيار منها.

## الخصوصية

تم حذف عمود تاريخ الميلاد نهائيًا من البيانات (`results.xlsx` و`results.json`
معًا) بناءً على طلب صريح، ولا يُعرض أو يُطلب في أي واجهة من واجهات الموقع.

## تحديث البيانات مستقبلًا

عند توفّر ملف نتائج جديد، ضعه في `data/results.xlsx` ثم أعد توليد `results.json`
بسكربت مشابه لهذا (يتطلب `pandas`):

```python
import pandas as pd, json, math

df = pd.read_excel("data/results.xlsx")


def clean(v):
    if isinstance(v, float) and math.isnan(v):
        return ""
    if isinstance(v, float) and v == int(v):
        return int(v)
    return v

def build_dict(pairs):
    uniq, idx_map, idx_list = [], {}, []
    for p in pairs:
        if p not in idx_map:
            idx_map[p] = len(uniq)
            uniq.append(p)
        idx_list.append(idx_map[p])
    return idx_list, uniq

wilaya_pairs = list(zip(df["Wilaya_FR"], df["Wilaya_AR"]))
centre_pairs = list(zip(df["Centre Examen  FR"], df["Centre Examen  AR"]))
etab_pairs   = list(zip(df["Etablissement_FR"], df["Etablissement_AR"]))
serie_pairs  = list(zip(df["SERIE"], df["Serie_FR"], df["Serie_AR"]))
lieu_pairs   = list(zip(df["Lieun_FR"], df["Lieun_AR"]))

w_idx, w_uniq = build_dict(wilaya_pairs)
c_idx, c_uniq = build_dict(centre_pairs)
e_idx, e_uniq = build_dict(etab_pairs)
s_idx, s_uniq = build_dict(serie_pairs)
l_idx, l_uniq = build_dict(lieu_pairs)
d_idx, d_uniq = build_dict([(x,) for x in df["Decision"]])
d_uniq = [x[0] for x in d_uniq]

rows = [[
    int(df["Noreg"].iloc[i]), w_idx[i], c_idx[i], e_idx[i],
    str(df["Num_Bac"].iloc[i]), s_idx[i],
    clean(df["Nom_FR"].iloc[i]), clean(df["NOM_AR"].iloc[i]),
    l_idx[i], round(float(df["Moy_Bac"].iloc[i]), 4), d_idx[i],
] for i in range(len(df))]

payload = {
    "dicts": {"wilaya": w_uniq, "centre": c_uniq, "etab": e_uniq,
              "serie": s_uniq, "lieu": l_uniq, "decision": d_uniq},
    "cols": ["noreg","wilaya","centre","etab","numbac","serie",
             "nomFr","nomAr","lieu","moy","decision"],
    "rows": rows,
}

with open("data/results.json","w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
```

## إخلاء مسؤولية

هذه بوابة استعلام غير رسمية أُعدّت لعرض ملف النتائج المزوَّد. لأي اعتماد رسمي،
يُرجى الرجوع إلى وزارة التهذيب الوطني الموريتانية.





 