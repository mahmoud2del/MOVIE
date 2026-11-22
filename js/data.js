// تعريف الحقول: [المفتاح في القاعدة, عنوان العمود في ملف الإكسل الأصلي, الاسم المعروض, النوع]
const FIELDS = [
  ['doc_id','doc.ID','رقم الوثيقة','int'],
  ['tape_id','tape.ID','معرّف الشريط','int'],
  ['work_name','اسم العمل','اسم العمل','text'],
  ['tape_no','رقم الشريط','رقم الشريط','int'],
  ['work_type','نوع العمل','نوع العمل','text'],
  ['tape_kind','نوع الشريط','نوع الشريط','text'],
  ['translation','الترجمة','الترجمة','text'],
  ['part','الجزء','الجزء','text'],
  ['episode','EPESOD','الحلقات','text'],
  ['episodes_count','عدد الحلقات','عدد الحلقات','text'],
  ['color','اللون','اللون','text'],
  ['license_tape','lincec-tape','lincec-tape','text'],
  ['duration','duration','المدة','text'],
  ['notes','ملاحظات','ملاحظات','text'],
  ['state','state','الحالة','text'],
  ['hard_ch1','hard_CH1','نسخة CH1','bool'],
  ['taps','taps','taps','int'],
  ['director','اخراج','إخراج','text'],
  ['singers','SINGERS','المطربون','text'],
  ['category','تصنيف العمل','تصنيف العمل','text'],
  ['cast_names','الابطال','الأبطال','text'],
  ['author','مؤلف','مؤلف','text'],
  ['source_song','SOURCSONG','مصدر الأغنية','text'],
  ['scripts','SCRIPTS','السيناريو','text'],
  ['story','القصة','القصة','text'],
];
const LABEL = Object.fromEntries(FIELDS.map(f => [f[0], f[2]]));
const TYPE = Object.fromEntries(FIELDS.map(f => [f[0], f[3]]));

// ألوان الحالة
const STATE_CLASS = {
  'مقبول':'ok', 'نسخه اذاعه':'info', 'نسخه بالمحذوفات':'info',
  'مرفوض هندسي':'bad', 'غير صالح هندسي':'bad', 'مرفوض رقابيا':'bad',
  'مقطوع':'warn', 'بدون مونتاج':'warn', 'بدون فحص':'warn', 'رد':'warn',
  'غير معلوم':'muted'
};
