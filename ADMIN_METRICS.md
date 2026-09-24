# Admin metrics reference

<!-- Generated from worker/src/adminMetrics.ts by worker/src/adminMetrics.test.ts. Do not edit by hand:
     UPDATE_ADMIN_METRICS_DOC=1 npx vitest run src/adminMetrics.test.ts  (from worker/) -->

Every number on the private `/admin` dashboard is defined once, in `worker/src/adminMetrics.ts`. The dashboard shows
the same definition under “How is this counted?” next to each figure, in Arabic or English. This file is generated
from that dictionary so the page, the SQL (`worker/src/analytics.ts`) and this reference cannot drift apart.

## Vocabulary

- **Session** — one anonymous random id kept in the browser’s `sessionStorage`. It lives as long as one tab. A new
  tab, another device or cleared site data is a new session. A session is never a person.
- **Questionnaire action** — a `quiz_started`, `quiz_answer` or `quiz_results_generated` event.
- **Idle** — no event of any kind from the session for 30 minutes. A questionnaire session whose
  latest action is an answer with no results after it is “stopped” once idle and “still answering” before that.
- **Time windows** — event metrics use the event time; session metrics use sessions active at any point in the
  range; ratings and reports use their creation time; the Country Intelligence snapshot and the city-description
  cache ignore the date filter.
- **Retention** — events, ratings and sessions older than 90 days are deleted; reports older than 90 days are
  detached from their session (see `runProductRetention` in `worker/src/product.ts`).
- **Privacy** — no metric reads a coordinate, an IP address or a fingerprint; the only geography is the coarse
  country Cloudflare attaches at the edge.

## Overview — نظرة عامة

### Sessions — الجلسات

`overview.sessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Anonymous sessions active at any point inside the selected range. | الجلسات المجهولة التي كان لها نشاط في أي لحظة داخل النطاق المحدد. |
| Counts | Sessions whose first and last activity overlap the range and match the filters | الجلسات التي يتقاطع أول وآخر نشاط لها مع النطاق وتطابق عوامل التصفية |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Count | عدد |
| Time window | Sessions active at any point inside the date filter | الجلسات النشطة في أي لحظة داخل مرشح التاريخ |
| Source | `sessions` | `sessions` |
| How to read it | How much the product was used. Compare ranges of equal length. | حجم استخدام المنتج. قارن بين نطاقات متساوية الطول. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Page views — مشاهدات الصفحات

`overview.pageViews`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Screens shown: one page view per move to another page or language switch. | الشاشات المعروضة: مشاهدة واحدة لكل انتقال إلى صفحة أخرى أو تبديل للغة. |
| Counts | Page-view events in the range | أحداث مشاهدة الصفحات ضمن النطاق |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_view` | `events: page_view` |
| How to read it | Depth of browsing. Page views ÷ sessions ≈ screens per session. | عمق التصفح. مشاهدات الصفحات ÷ الجلسات ≈ عدد الشاشات لكل جلسة. |
| Limitation | Switching the site language re-counts the current screen. | تبديل لغة الموقع يعيد احتساب الشاشة الحالية. |

### Questionnaire sessions — جلسات الاستبيان

`overview.questionnaireSessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that entered the questionnaire: picked a purpose, answered a question or reached results. | الجلسات التي دخلت الاستبيان: اختارت غرضًا أو أجابت عن سؤال أو وصلت إلى النتائج. |
| Counts | Distinct sessions with any questionnaire action in the range | الجلسات المميزة التي لديها أي إجراء استبيان ضمن النطاق |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started, quiz_answer, quiz_results_generated` | `events: quiz_started, quiz_answer, quiz_results_generated` |
| How to read it | The base every questionnaire rate on this dashboard is divided by. | الأساس الذي تُقسم عليه كل معدلات الاستبيان في هذه اللوحة. |
| Limitation | Opening the questionnaire from “Edit my preferences” skips the purpose picker; answering is what counts it then. | فتح الاستبيان من «تعديل تفضيلاتي» يتجاوز اختيار الغرض؛ فيُحتسب عندها بأول إجابة. |

### Completed questionnaires — الاستبيانات المكتملة

`overview.completions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that reached results at least once. | الجلسات التي وصلت إلى النتائج مرة واحدة على الأقل. |
| Counts | Distinct sessions that reached results in the range | الجلسات المميزة التي وصلت إلى النتائج ضمن النطاق |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_results_generated` | `events: quiz_results_generated` |
| How to read it | A session that completes twice (retake or edited preferences) is still one. | الجلسة التي تُكمل مرتين (إعادة أو تعديل تفضيلات) تُحتسب مرة واحدة. |
| Limitation | Includes completions that end on a destination page (“How well does it suit me?”) as well as on Results. | يشمل الإكمال الذي ينتهي في صفحة وجهة («ما مدى ملاءمتها لي؟») وكذلك في صفحة النتائج. |

### Completion rate — معدّل الإكمال

`overview.completionRate`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Share of questionnaire sessions that reached results. | نسبة جلسات الاستبيان التي وصلت إلى النتائج. |
| Counts | Completed questionnaires | الاستبيانات المكتملة |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | percent | نسبة مئوية |
| Aggregation | Ratio | نسبة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started, quiz_answer, quiz_results_generated` | `events: quiz_started, quiz_answer, quiz_results_generated` |
| How to read it | Higher is better. A drop points at a question or step where people leave — see the Funnel tab. | كلما ارتفع كان أفضل. الانخفاض يشير إلى سؤال أو خطوة يغادر عندها الناس — راجع تبويب مسار الاستبيان. |
| Limitation | Sessions still answering at the end of the range count as not completed. | الجلسات التي لا تزال تُجيب عند نهاية النطاق تُحتسب غير مكتملة. |

### Results page views — مشاهدات صفحة النتائج

`overview.resultsViewed`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Times the Results screen was shown. | عدد مرات عرض شاشة النتائج. |
| Counts | Page views of the Results screen | مشاهدات شاشة النتائج |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_view on /results` | `events: page_view on /results` |
| How to read it | Returns to Results (back navigation, language switch) count again. | العودة إلى النتائج (الرجوع أو تبديل اللغة) تُحتسب مرة أخرى. |
| Limitation | A questionnaire opened from a destination page ends on that page, not on Results. | الاستبيان المفتوح من صفحة وجهة ينتهي في تلك الصفحة وليس في النتائج. |

### Ratings — التقييمات

`overview.ratings`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Ratings submitted: results ratings and destination ratings together. | التقييمات المرسلة: تقييمات النتائج وتقييمات الوجهات معًا. |
| Counts | Rating rows created in the range | صفوف التقييم المنشأة ضمن النطاق |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | ratings | تقييمات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings` | `ratings` |
| How to read it | Volume behind the average rating: few ratings mean a fragile average. | الحجم الذي يستند إليه متوسط التقييم: قلة التقييمات تعني متوسطًا هشًّا. |
| Limitation | Only travellers who chose to rate are counted — a self-selected group. | تُحتسب فقط تقييمات من اختار التقييم — عيّنة اختارت نفسها. |

### Average rating — متوسط التقييم

`overview.averageRating`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean overall score of all ratings in the range, on a 1–5 scale. | متوسط الدرجة الكلية لكل التقييمات ضمن النطاق، على مقياس من 1 إلى 5. |
| Counts | Sum of overall scores | مجموع الدرجات الكلية |
| Divided by | Number of ratings | عدد التقييمات |
| Unit | score from 1 to 5 | درجة من 1 إلى 5 |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings.overall_score` | `ratings.overall_score` |
| How to read it | Read it next to the rating count and the distribution on the Recommendation quality tab. | اقرأه مع عدد التقييمات والتوزيع في تبويب جودة التوصيات. |
| Limitation | Mixes results ratings and destination ratings, which answer different questions. | يمزج تقييمات النتائج وتقييمات الوجهات، وهما يجيبان عن سؤالين مختلفين. |

### Reports — البلاغات

`overview.reports`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Reports and feedback messages travellers sent. | البلاغات ورسائل الملاحظات التي أرسلها المسافرون. |
| Counts | Feedback rows created in the range | صفوف الملاحظات المنشأة ضمن النطاق |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | reports | بلاغات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `feedback` | `feedback` |
| How to read it | Work waiting in the Reports tab; open it to triage. | عمل ينتظر في تبويب البلاغات؛ افتحه للفرز. |
| Limitation | Counts reports whose anonymous session still exists. After 90 days a report is detached from its session, and only the Reports tab still lists it. | يعدّ البلاغات التي لا تزال جلستها المجهولة موجودة. بعد 90 يومًا يُفصل البلاغ عن جلسته، ولا يعرضه إلا تبويب البلاغات. |

## Questionnaire — الاستبيان

### Average questions answered — متوسط الأسئلة المُجابة

`funnel.averageDistinctQuestions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean number of DIFFERENT questions a session answered. | متوسط عدد الأسئلة المختلفة التي أجابت عنها الجلسة. |
| Counts | Sum over sessions of distinct questions answered | مجموع الأسئلة المختلفة المُجابة عبر الجلسات |
| Divided by | Sessions that answered at least one question | الجلسات التي أجابت عن سؤال واحد على الأقل |
| Unit | questions | أسئلة |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer.questionId` | `events: quiz_answer.questionId` |
| How to read it | How deep people go. Early results are offered after 5 answers; the full length depends on the purpose and on whether a location was shared. | إلى أي عمق يصل الناس. تُعرض النتائج المبكرة بعد 5 إجابات؛ ويعتمد الطول الكامل على الغرض وعلى مشاركة الموقع. |
| Limitation | Changing an answer does not add a question; answering the same question in two purposes adds two. | تغيير الإجابة لا يضيف سؤالًا؛ والإجابة عن السؤال نفسه في غرضين تضيف سؤالين. |

### Finished with results — انتهت بالنتائج

`funnel.outcome.finished`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Questionnaire sessions whose latest questionnaire action was reaching results. | جلسات الاستبيان التي كان آخر إجراء فيها هو الوصول إلى النتائج. |
| Counts | Sessions whose last completion is not followed by another answer | الجلسات التي لا تتبع آخرَ إكمال فيها أيُّ إجابة |
| Divided by | Questionnaire sessions (the four outcomes add up to it) | جلسات الاستبيان (النتائج الأربع مجموعها يساويها) |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated` | `events: quiz_answer, quiz_results_generated` |
| How to read it | The healthy outcome. | النتيجة السليمة. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Stopped before results — توقفت قبل النتائج

`funnel.outcome.stopped`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions whose latest questionnaire action was an answer, with no results after it and no activity for 30 minutes. | الجلسات التي كان آخر إجراء استبيان فيها إجابةً، دون نتائج بعدها ودون أي نشاط لمدة 30 دقيقة. |
| Counts | Idle sessions whose last answer has no later completion | الجلسات الخاملة التي لا يلي آخرَ إجابة فيها إكمال |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` |
| How to read it | The drop-off. The question table shows which question each of these sessions answered last. | حالات الانسحاب. جدول الأسئلة يبيّن آخر سؤال أجابت عنه كل جلسة منها. |
| Limitation | A session that completed earlier and then left a later retake unfinished counts here, because its latest attempt stopped. | الجلسة التي أكملت سابقًا ثم تركت إعادة لاحقة دون إكمال تُحتسب هنا، لأن محاولتها الأخيرة توقفت. |

### Still answering — لا تزال تُجيب

`funnel.outcome.inProgress`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Like “Stopped before results”, but the session was active in the last 30 minutes — it may still finish. | مثل «توقفت قبل النتائج»، لكن الجلسة كانت نشطة في آخر 30 دقيقة — قد تُكمل بعد. |
| Counts | Recently active sessions whose last answer has no later completion | الجلسات النشطة مؤخرًا التي لا يلي آخرَ إجابة فيها إكمال |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` |
| How to read it | Kept apart so a live session is never reported as a drop-off. | تُفصل حتى لا تُحتسب جلسة حية كحالة انسحاب. |
| Limitation | Measured against the time the dashboard loaded; it moves as time passes. | يُقاس نسبةً إلى وقت تحميل اللوحة؛ ويتغير بمرور الوقت. |

### Picked a purpose, answered nothing — اختارت غرضًا ولم تُجب

`funnel.outcome.neverAnswered`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that picked a purpose but never answered a question or reached results. | الجلسات التي اختارت غرضًا لكنها لم تُجب عن أي سؤال ولم تصل إلى النتائج. |
| Counts | Sessions that picked a purpose with no answer and no completion | الجلسات التي اختارت غرضًا دون أي إجابة أو إكمال |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started, quiz_answer, quiz_results_generated` | `events: quiz_started, quiz_answer, quiz_results_generated` |
| How to read it | People who left at the first question itself. | من غادروا عند السؤال الأول نفسه. |
| Limitation | Includes sessions still looking at the first question. | يشمل جلسات لا تزال تنظر إلى السؤال الأول. |

### Completed more than once — أكملت أكثر من مرة

`funnel.completedMoreThanOnce`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that reached results two or more times — a retake or “Edit my preferences”. | الجلسات التي وصلت إلى النتائج مرتين أو أكثر — إعادة أو «تعديل تفضيلاتي». |
| Counts | Sessions with 2+ completions | الجلسات التي لديها إكمالان أو أكثر |
| Divided by | Completed questionnaires | الاستبيانات المكتملة |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_results_generated` | `events: quiz_results_generated` |
| How to read it | Engagement with personalization, or dissatisfaction with a first set of results. | تفاعل مع التخصيص، أو عدم رضا عن أول مجموعة نتائج. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Restarted — بدأت من جديد

`funnel.restarted`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that picked a purpose two or more times. | الجلسات التي اختارت غرضًا مرتين أو أكثر. |
| Counts | Sessions that picked a purpose twice or more | الجلسات التي اختارت غرضًا مرتين أو أكثر |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started` | `events: quiz_started` |
| How to read it | Going back to the purpose picker mid-questionnaire or after results. | العودة إلى اختيار الغرض أثناء الاستبيان أو بعد النتائج. |
| Limitation | Choosing the same purpose again counts as a restart. | اختيار الغرض نفسه مرة أخرى يُحتسب بداية جديدة. |

### Changed purpose — غيّرت الغرض

`funnel.changedPurpose`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that started two or more DIFFERENT purposes. | الجلسات التي بدأت غرضين مختلفين أو أكثر. |
| Counts | Sessions with 2+ distinct started purposes | الجلسات التي بدأت غرضين مختلفين أو أكثر |
| Divided by | Questionnaire sessions | جلسات الاستبيان |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started.purpose` | `events: quiz_started.purpose` |
| How to read it | A high value can mean the purpose names are unclear. | ارتفاعه قد يعني أن أسماء الأغراض غير واضحة. |
| Limitation | Cannot tell exploring several purposes from correcting a mis-click. | لا يميّز بين استكشاف عدة أغراض وتصحيح نقرة خاطئة. |

### Checkpoint after 5 answers — نقطة التوقف بعد 5 إجابات

`funnel.checkpoint`

| Field | English | العربية |
| --- | --- | --- |
| Definition | What sessions chose when offered early results after the 5th answer. | ما اختارته الجلسات عند عرض النتائج المبكرة بعد الإجابة الخامسة. |
| Counts | Sessions that made each choice | الجلسات التي اتخذت كل خيار |
| Divided by | Sessions that made any checkpoint choice | الجلسات التي اتخذت أي خيار عند نقطة التوقف |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_checkpoint_choice.choice` | `events: quiz_checkpoint_choice.choice` |
| How to read it | Many early exits suggest the remaining questions feel long. | كثرة الخروج المبكر تشير إلى أن الأسئلة المتبقية تبدو طويلة. |
| Limitation | Sessions that left at the checkpoint without choosing are not counted here; they appear as stopped after their 5th answer. | الجلسات التي غادرت عند نقطة التوقف دون اختيار لا تُحتسب هنا؛ تظهر كمتوقفة بعد إجابتها الخامسة. |

### Sessions that answered — جلسات أجابت

`funnel.question.sessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct sessions that answered this question at least once. | الجلسات المميزة التي أجابت عن هذا السؤال مرة واحدة على الأقل. |
| Counts | Distinct sessions with an answer to this question | الجلسات المميزة التي لديها إجابة عن هذا السؤال |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer.questionId` | `events: quiz_answer.questionId` |
| How to read it | The questionnaire is adaptive: a question nobody reached may simply not be asked on common paths. | الاستبيان متكيّف: السؤال الذي لم يصله أحد قد لا يُطرح أصلًا في المسارات الشائعة. |
| Limitation | Location-dependent questions (distance and land borders) are only asked when a location is shared. | الأسئلة المعتمدة على الموقع (المسافة والحدود البرية) لا تُطرح إلا عند مشاركة الموقع. |

### Answer events — أحداث الإجابة

`funnel.question.answers`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Every time this question was answered, including changed answers and retakes. | كل مرة أُجيب فيها عن هذا السؤال، بما في ذلك تغيير الإجابة وإعادة الاستبيان. |
| Counts | Answer events for this question | أحداث الإجابة عن هذا السؤال |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer.questionId` | `events: quiz_answer.questionId` |
| How to read it | Answer events well above sessions means people revisit this question. | زيادة أحداث الإجابة كثيرًا عن الجلسات تعني أن الناس يعودون إلى هذا السؤال. |
| Limitation | Cannot tell a changed answer from a full retake. | لا يميّز بين تغيير إجابة وإعادة الاستبيان بالكامل. |

### Average position — متوسط الموضع

`funnel.question.averagePosition`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Where in the adaptive sequence this question was asked (1 = first), averaged, with the earliest–latest range. | موضع هذا السؤال في التسلسل المتكيّف (1 = الأول)، كمتوسط مع المدى من الأبكر إلى الأخير. |
| Counts | Sum of positions | مجموع المواضع |
| Divided by | Answer events for this question | أحداث الإجابة لهذا السؤال |
| Unit | position in the questionnaire | الموضع في الاستبيان |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer.questionNumber` | `events: quiz_answer.questionNumber` |
| How to read it | A wide range means the adaptive order moves this question around. | اتساع المدى يعني أن الترتيب المتكيّف ينقل هذا السؤال بين المواضع. |
| Limitation | Position is where it was answered; a question reached but not answered has no position. | الموضع هو حيث أُجيب عنه؛ السؤال الذي عُرض ولم يُجب عنه ليس له موضع. |

### Went on to results — وصلت إلى النتائج بعده

`funnel.question.completedAfter`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions that answered this question and reached results afterwards. | الجلسات التي أجابت عن هذا السؤال ثم وصلت إلى النتائج بعده. |
| Counts | Sessions with a completion later than an answer to this question | الجلسات التي لديها إكمال لاحق لإجابة عن هذا السؤال |
| Divided by | Sessions that answered | جلسات أجابت |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated` | `events: quiz_answer, quiz_results_generated` |
| How to read it | Continuation all the way to results from this question. | الاستمرار من هذا السؤال حتى النتائج. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Stopped after this question — توقفت بعد هذا السؤال

`funnel.question.stoppedHere`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Stopped sessions (see “Stopped before results”) whose LAST answer was this question. | الجلسات المتوقفة (راجع «توقفت قبل النتائج») التي كانت آخر إجابة فيها عن هذا السؤال. |
| Counts | Stopped sessions whose last answer is this question | الجلسات المتوقفة التي آخر إجابة فيها لهذا السؤال |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` |
| How to read it | The person left on the NEXT screen — the next question, the 5-answer checkpoint, or the final step before results. | غادر الشخص في الشاشة التالية — السؤال التالي، أو نقطة التوقف بعد 5 إجابات، أو الخطوة الأخيرة قبل النتائج. |
| Limitation | Questions are not logged when shown, only when answered, so the exact screen left is not recorded. | لا يُسجَّل السؤال عند عرضه بل عند الإجابة عنه فقط، لذا لا تُسجَّل الشاشة التي غادرها الشخص بدقة. |

### Drop-off after — الانسحاب بعده

`funnel.question.dropOff`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Share of the sessions that answered this question which then stopped. | نسبة الجلسات التي أجابت عن هذا السؤال ثم توقفت. |
| Counts | Stopped after this question | توقفت بعد هذا السؤال |
| Divided by | Sessions that answered | جلسات أجابت |
| Unit | percent | نسبة مئوية |
| Aggregation | Ratio | نسبة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` | `events: quiz_answer, quiz_results_generated; sessions.last_seen_at` |
| How to read it | Compare questions within one purpose; the highest value marks the weakest step. | قارن بين أسئلة الغرض الواحد؛ أعلى قيمة تحدد أضعف خطوة. |
| Limitation | Small counts swing widely — read it with the session count. | الأعداد الصغيرة تتذبذب كثيرًا — اقرأه مع عدد الجلسات. |

### Sessions reaching each position — الجلسات التي بلغت كل موضع

`funnel.position.sessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct sessions that answered a question at each position, whatever the question was. | الجلسات المميزة التي أجابت عن سؤال في كل موضع، أيًّا كان السؤال. |
| Counts | Distinct sessions with an answer at this position | الجلسات المميزة التي لديها إجابة في هذا الموضع |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_answer.questionNumber` | `events: quiz_answer.questionNumber` |
| How to read it | The classic funnel shape: how many get to question 1, 2, 3 … | شكل القمع التقليدي: كم يصل إلى السؤال 1 و2 و3 … |
| Limitation | Mixes purposes, whose questionnaires have different lengths. | يمزج الأغراض، واستبياناتها مختلفة الطول. |

### Completion by purpose — الإكمال حسب الغرض

`funnel.purpose.completionRate`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Per purpose: sessions that reached results ÷ sessions that answered in that purpose. | لكل غرض: الجلسات التي وصلت إلى النتائج ÷ الجلسات التي أجابت في ذلك الغرض. |
| Counts | Sessions with a completion in this purpose | الجلسات التي أكملت في هذا الغرض |
| Divided by | Sessions that answered or completed in this purpose | الجلسات التي أجابت أو أكملت في هذا الغرض |
| Unit | percent | نسبة مئوية |
| Aggregation | Ratio | نسبة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_started, quiz_answer, quiz_results_generated (.purpose)` | `events: quiz_started, quiz_answer, quiz_results_generated (.purpose)` |
| How to read it | Which purpose loses people. “Picked” counts sessions that chose the purpose on the picker. | أي غرض يفقد الناس. «اختيار» يعدّ الجلسات التي اختارت الغرض من شاشة الأغراض. |
| Limitation | A session that tried two purposes counts in both. | الجلسة التي جرّبت غرضين تُحتسب في كليهما. |

## Recommendation quality — جودة التوصيات

### Ratings by score — التقييمات حسب الدرجة

`quality.distribution`

| Field | English | العربية |
| --- | --- | --- |
| Definition | How many ratings gave each score from 1 to 5. | عدد التقييمات لكل درجة من 1 إلى 5. |
| Counts | Ratings with each score | التقييمات بكل درجة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | ratings | تقييمات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings.overall_score` | `ratings.overall_score` |
| How to read it | Two peaks (1 and 5) mean the average hides a split. | وجود قمتين (1 و5) يعني أن المتوسط يخفي انقسامًا. |
| Limitation | Self-selected: only travellers who chose to rate. | عيّنة اختارت نفسها: فقط من اختار التقييم. |

### Destination rating by country — تقييم الوجهة حسب الدولة

`quality.countryAverage`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean destination-page rating per country, lowest first. | متوسط تقييم صفحة الوجهة لكل دولة، الأقل أولًا. |
| Counts | Sum of destination ratings for the country | مجموع تقييمات الوجهة للدولة |
| Divided by | Destination ratings for the country | تقييمات الوجهة للدولة |
| Unit | score from 1 to 5 | درجة من 1 إلى 5 |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings (kind = destination)` | `ratings (kind = destination)` |
| How to read it | Countries whose pages disappoint; check their content first. | الدول التي تخيّب صفحاتها التوقعات؛ راجع محتواها أولًا. |
| Limitation | One or two ratings make an unreliable average — read the count. | تقييم أو تقييمان يعطيان متوسطًا غير موثوق — اقرأ العدد. |

### Results rating by questionnaire path — تقييم النتائج حسب مسار الاستبيان

`quality.pathAverage`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Results ratings grouped by the purpose and the number of answers in the rating session. | تقييمات النتائج مجمّعة حسب الغرض وعدد الإجابات في جلسة التقييم. |
| Counts | Sum of results ratings on the path | مجموع تقييمات النتائج في المسار |
| Divided by | Results ratings on the path | تقييمات النتائج في المسار |
| Unit | score from 1 to 5 | درجة من 1 إلى 5 |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings (kind = results); events: quiz_started, quiz_answer` | `ratings (kind = results); events: quiz_started, quiz_answer` |
| How to read it | Whether short questionnaires produce worse-rated results. | هل تنتج الاستبيانات القصيرة نتائج أقل تقييمًا. |
| Limitation | Uses the session’s first purpose and all its answers, even across retakes. | يستخدم أول غرض في الجلسة وكل إجاباتها، حتى عبر الإعادات. |

## Countries — الدول

### Countries ever recommended — الدول التي أُوصي بها ولو مرة

`countries.everRecommended`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct countries that appeared in at least one generated top 5. | الدول المميزة التي ظهرت في قائمة أفضل 5 مولَّدة واحدة على الأقل. |
| Counts | Distinct country codes in generated top-5 lists | رموز الدول المميزة في قوائم أفضل 5 المولَّدة |
| Divided by | 194 destinations in the catalog | 194 وجهة في الكتالوج |
| Unit | countries | دول |
| Aggregation | Distinct count | عدد مميز |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_results_generated.results[]` | `events: quiz_results_generated.results[]` |
| How to read it | Breadth of recommendations; a small number means the same few countries win. | اتساع التوصيات؛ الرقم الصغير يعني أن الدول نفسها تفوز دائمًا. |
| Limitation | Only the top 5 are logged; places 6 and below are not visible here. | تُسجَّل أفضل 5 فقط؛ المراتب من 6 فما دون لا تظهر هنا. |

### Top-5 appearances — مرات الظهور ضمن أفضل 5

`countries.appearances`

| Field | English | العربية |
| --- | --- | --- |
| Definition | How many generated top-5 lists included the country. | عدد قوائم أفضل 5 المولَّدة التي تضمنت الدولة. |
| Counts | Top-5 lists containing the country | قوائم أفضل 5 التي تحتوي الدولة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: quiz_results_generated.results[]` | `events: quiz_results_generated.results[]` |
| How to read it | Least-recommended lists only countries that appeared at least once. | قائمة الأقل توصية تضم فقط الدول التي ظهرت مرة واحدة على الأقل. |
| Limitation | A session that completes twice contributes two lists. | الجلسة التي تُكمل مرتين تضيف قائمتين. |

### Destination opens — فتح صفحات الوجهات

`countries.opens`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Destination pages opened by clicking a destination card. | صفحات الوجهات المفتوحة بالنقر على بطاقة وجهة. |
| Counts | Destination-card clicks that opened a page | نقرات بطاقات الوجهات التي فتحت صفحة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: destination_opened` | `events: destination_opened` |
| How to read it | Where attention goes. “Source” says which screen the card was on. | أين يتجه الاهتمام. «المصدر» يبيّن الشاشة التي كانت عليها البطاقة. |
| Limitation | A page reached by typing or sharing its address is not counted. | الصفحة التي يُوصل إليها بكتابة عنوانها أو مشاركته لا تُحتسب. |

### Surprise Me results opened — نتائج فاجئني بوجهة المفتوحة

`countries.surpriseOpened`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Destination opens that came from the Surprise Me wheel. | مرات فتح الوجهات القادمة من عجلة فاجئني بوجهة. |
| Counts | Destination opens whose source is Surprise Me | مرات فتح الوجهات التي مصدرها فاجئني بوجهة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: destination_opened (source = surprise)` | `events: destination_opened (source = surprise)` |
| How to read it | Compare with Surprise spins on the Discovery tab. | قارنه بمرات تدوير فاجئني في تبويب الاستكشاف. |
| Limitation | Same card-click limitation as destination opens. | القيد نفسه الخاص بالنقر على البطاقة كما في فتح الوجهات. |

### Surprise Me landings — مرات استقرار فاجئني

`countries.surpriseLandings`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Countries the Surprise Me wheel landed on. | الدول التي استقرت عليها عجلة فاجئني بوجهة. |
| Counts | Times the wheel stopped on a country | مرات توقف العجلة على دولة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: surprise_result` | `events: surprise_result` |
| How to read it | The wheel is random among the filtered candidates; heavy repeats point at narrow filters. | العجلة عشوائية بين المرشحين بعد التصفية؛ كثرة التكرار تشير إلى تصفية ضيقة. |
| Limitation | Counts landings, not whether the traveller liked the result. | يعدّ مرات الاستقرار، لا رضا المسافر عن النتيجة. |

### Reports per country — البلاغات لكل دولة

`countries.reports`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Reports filed from a specific country page. | البلاغات المقدَّمة من صفحة دولة محددة. |
| Counts | Feedback rows with this country code | صفوف الملاحظات بهذا الرمز |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | reports | بلاغات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `feedback.country_code` | `feedback.country_code` |
| How to read it | Open the Reports tab and search the country code to read them. | افتح تبويب البلاغات وابحث برمز الدولة لقراءتها. |
| Limitation | Reports sent from other pages carry no country. | البلاغات المرسلة من صفحات أخرى لا تحمل دولة. |

## Discovery — الاستكشاف

### Search box uses — استخدامات مربع البحث

`discovery.searchInteractions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Times the Explore search box was left (focus moved away), with or without text. | عدد مرات مغادرة مربع البحث في استكشف (انتقال التركيز)، بنص أو بدونه. |
| Counts | Times the search box was left | مرات مغادرة مربع البحث |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: explore_search` | `events: explore_search` |
| How to read it | Interest in finding a named country. | الاهتمام بالبحث عن دولة بالاسم. |
| Limitation | The search text itself is never recorded — only whether there was any and its length. | نص البحث نفسه لا يُسجَّل أبدًا — فقط وجوده وطوله. |

### Searches with text — عمليات بحث بنص

`discovery.searchWithText`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Search box uses that left text in the box. | استخدامات مربع البحث التي تُرك فيها نص. |
| Counts | Times the search box was left with text in it | مرات مغادرة مربع البحث وفيه نص |
| Divided by | Search box uses | استخدامات مربع البحث |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: explore_search (used = true)` | `events: explore_search (used = true)` |
| How to read it | Real searches, as opposed to clicking in and out. | عمليات بحث فعلية، لا مجرد النقر داخل المربع وخارجه. |
| Limitation | One search typed then refined counts once per time the box is left. | البحث المكتوب ثم المعدَّل يُحتسب مرة لكل مغادرة للمربع. |

### Filter and sort changes — تغييرات التصفية والترتيب

`discovery.filterChanges`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Changes to an Explore filter or the sort, by which control and which value. | تغييرات عوامل التصفية أو الترتيب في استكشف، حسب العنصر والقيمة. |
| Counts | Changes to a filter or the sort | تغييرات عوامل التصفية أو الترتيب |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: explore_filter_changed` | `events: explore_filter_changed` |
| How to read it | Which ways of narrowing the catalog people actually use. | طرق تضييق الكتالوج التي يستخدمها الناس فعلًا. |
| Limitation | “All …” means the control was set back to no filter. | «الكل …» تعني إعادة العنصر إلى عدم التصفية. |

### Filter resets — إعادة ضبط التصفية

`discovery.filterResets`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Clicks on the Explore “reset filters” control. | النقرات على زر «إعادة ضبط عوامل التصفية» في استكشف. |
| Counts | Clicks on reset filters | نقرات إعادة ضبط التصفية |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: explore_filters_reset` | `events: explore_filters_reset` |
| How to read it | Frequent resets can mean filters lead to empty or unhelpful lists. | كثرة إعادة الضبط قد تعني أن التصفية تنتهي بقوائم فارغة أو غير مفيدة. |
| Limitation | Does not record which filters were active before the reset. | لا يسجّل عوامل التصفية التي كانت مفعّلة قبل إعادة الضبط. |

### Surprise spins — مرات تدوير فاجئني

`discovery.surpriseSpins`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Times the Surprise Me wheel was spun. | عدد مرات تدوير عجلة فاجئني بوجهة. |
| Counts | Wheel spins | مرات تدوير العجلة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: surprise_spin` | `events: surprise_spin` |
| How to read it | Spins ÷ sessions that spun ≈ spins per curious visitor. | مرات التدوير ÷ الجلسات التي دوّرت ≈ عدد التدويرات لكل زائر فضولي. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Sessions that spun — جلسات استخدمت فاجئني

`discovery.surpriseSessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct sessions that spun the Surprise Me wheel at least once. | الجلسات المميزة التي دوّرت عجلة فاجئني بوجهة مرة واحدة على الأقل. |
| Counts | Distinct sessions with at least one spin | الجلسات المميزة التي لديها تدوير واحد على الأقل |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: surprise_spin` | `events: surprise_spin` |
| How to read it | Reach of the Surprise Me feature. | مدى وصول ميزة فاجئني بوجهة. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

## Location — الموقع

### Sessions that requested location — جلسات طلبت الموقع

`location.asked`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct sessions where the browser location request ran at least once. | الجلسات المميزة التي نُفّذ فيها طلب الموقع من المتصفح مرة واحدة على الأقل. |
| Counts | Distinct sessions with a completed location request | الجلسات المميزة التي لديها طلب موقع مكتمل |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_request_outcome` | `events: location_request_outcome` |
| How to read it | How many travellers tried the location feature. | عدد المسافرين الذين جرّبوا ميزة الموقع. |
| Limitation | No coordinate is ever stored — only whether the request worked and how long it took. | لا يُخزَّن أي إحداثي أبدًا — فقط هل نجح الطلب وكم استغرق. |

### Sessions that got a location — جلسات حصلت على الموقع

`location.granted`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct sessions where at least one location request succeeded. | الجلسات المميزة التي نجح فيها طلب موقع واحد على الأقل. |
| Counts | Distinct sessions with a successful request | الجلسات المميزة التي لديها طلب ناجح |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Distinct sessions | جلسات مميزة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_request_outcome (outcome = ok)` | `events: location_request_outcome (outcome = ok)` |
| How to read it | Travellers who can use the distance sorts and the nearby question. | المسافرون الذين يمكنهم استخدام ترتيب المسافة وسؤال القرب. |
| Limitation | A session is one browser tab, not a person: the same traveller on two tabs or two devices counts twice. | الجلسة تبويب متصفح واحد وليست شخصًا: المسافر نفسه في تبويبين أو جهازين يُحتسب مرتين. |

### Location success rate — معدّل نجاح الموقع

`location.grantRate`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Share of sessions that requested a location and got one. | نسبة الجلسات التي طلبت الموقع وحصلت عليه. |
| Counts | Sessions that got a location | جلسات حصلت على الموقع |
| Divided by | Sessions that requested location | جلسات طلبت الموقع |
| Unit | percent | نسبة مئوية |
| Aggregation | Ratio | نسبة |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_request_outcome` | `events: location_request_outcome` |
| How to read it | A fall points at denials or timeouts — see the outcome tables. | الانخفاض يشير إلى رفض أو انتهاء مهلة — راجع جداول النتائج. |
| Limitation | A session that failed and later succeeded counts as a success. | الجلسة التي فشلت ثم نجحت لاحقًا تُحتسب ناجحة. |

### Location state changes — تغيّرات حالة الموقع

`location.statusChanges`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Each change of the site’s location state (asking, granted, denied …), as events and as distinct sessions. | كل تغيّر في حالة الموقع داخل الموقع (جارٍ الطلب، مسموح، مرفوض …)، كأحداث وكجلسات مميزة. |
| Counts | State changes per state; and distinct sessions per state | تغيّرات الحالة لكل حالة؛ والجلسات المميزة لكل حالة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_permission.outcome` | `events: location_permission.outcome` |
| How to read it | “Asking” counts requests started; the other states count how they ended. | «جارٍ الطلب» يعدّ الطلبات التي بدأت؛ والحالات الأخرى تعدّ كيف انتهت. |
| Limitation | One session can pass through several states, so sessions per state do not add up to a total. | قد تمر الجلسة الواحدة بعدة حالات، لذا لا يجمع عدد الجلسات لكل حالة إلى إجمالي. |

### Location requests — طلبات الموقع

`location.requests`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Completed location requests by result, with the mean time to that result. | طلبات الموقع المكتملة حسب النتيجة، مع متوسط الوقت حتى النتيجة. |
| Counts | Completed requests per result | الطلبات المكتملة لكل نتيجة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_request_outcome (.outcome, .totalMs)` | `events: location_request_outcome (.outcome, .totalMs)` |
| How to read it | Long average times on success mean the second, high-accuracy stage was often needed. | طول متوسط الوقت عند النجاح يعني أن المرحلة الثانية عالية الدقة كانت مطلوبة كثيرًا. |
| Limitation | Time is measured in the browser, in milliseconds; a mean is pulled up by a few slow devices. | يُقاس الوقت في المتصفح بالمللي ثانية؛ والمتوسط يرتفع بسبب أجهزة بطيئة قليلة. |

### Request stages — مراحل الطلب

`location.stageAttempts`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Individual attempts inside location requests: stage 1 coarse and cached, stage 2 high accuracy. | المحاولات الفردية داخل طلبات الموقع: المرحلة 1 تقريبية ومخزَّنة، والمرحلة 2 عالية الدقة. |
| Counts | Stage attempts per result and accuracy mode | محاولات المراحل لكل نتيجة ونمط دقة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: location_request_outcome.stages[]` | `events: location_request_outcome.stages[]` |
| How to read it | High-accuracy attempts appear only after stage 1 timed out or was unavailable. | محاولات الدقة العالية تظهر فقط بعد انتهاء مهلة المرحلة 1 أو تعذرها. |
| Limitation | Counts attempts, not sessions. | يعدّ المحاولات لا الجلسات. |

### Sessions by coarse country — الجلسات حسب الدولة التقريبية

`location.edgeSessions`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions by the country Cloudflare attaches to the request at its edge. | الجلسات حسب الدولة التي تُلحقها شبكة Cloudflare بالطلب عند الحافة. |
| Counts | Sessions per edge country | الجلسات لكل دولة حافة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Count | عدد |
| Time window | Sessions active at any point inside the date filter | الجلسات النشطة في أي لحظة داخل مرشح التاريخ |
| Source | `sessions.edge_country` | `sessions.edge_country` |
| How to read it | Where the audience connects from, at country level only. | من أين يتصل الجمهور، على مستوى الدولة فقط. |
| Limitation | A VPN or roaming shows the network’s country, not the traveller’s. Never finer than a country. | الشبكة الافتراضية أو التجوال يُظهران دولة الشبكة لا المسافر. ولا شيء أدق من الدولة. |

## Technical — تقني

### Performance samples — عيّنات الأداء

`technical.samples`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Full page loads that reported timing — one per load, not per screen change. | تحميلات الصفحة الكاملة التي أبلغت عن التوقيت — واحدة لكل تحميل، لا لكل تغيّر شاشة. |
| Counts | Page loads that reported timing | تحميلات الصفحة التي أبلغت عن التوقيت |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_performance` | `events: page_performance` |
| How to read it | The number of loads the timing averages are based on. | عدد التحميلات التي تستند إليها متوسطات التوقيت. |
| Limitation | Moving between screens inside the site is not a new load and adds no sample. | التنقل بين الشاشات داخل الموقع ليس تحميلًا جديدًا ولا يضيف عيّنة. |

### Average time to first byte — متوسط الوقت حتى أول بايت

`technical.ttfb`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean time from navigation start until the first byte of the page arrived. | متوسط الوقت من بدء التنقل حتى وصول أول بايت من الصفحة. |
| Counts | Sum of time to first byte | مجموع الوقت حتى أول بايت |
| Divided by | Performance samples | عيّنات الأداء |
| Unit | milliseconds | مللي ثانية |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_performance.ttfbMs` | `events: page_performance.ttfbMs` |
| How to read it | Network and hosting speed as travellers experience it. | سرعة الشبكة والاستضافة كما يختبرها المسافرون. |
| Limitation | A mean, not a percentile: a few slow connections pull it up. | متوسط لا مئين: قلة من الاتصالات البطيئة ترفعه. |

### Average document ready — متوسط جاهزية المستند

`technical.domReady`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean time from navigation start until the document was parsed and deferred scripts ran. | متوسط الوقت من بدء التنقل حتى تحليل المستند وتشغيل السكربتات المؤجلة. |
| Counts | Sum of document-ready times | مجموع أوقات جاهزية المستند |
| Divided by | Performance samples | عيّنات الأداء |
| Unit | milliseconds | مللي ثانية |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_performance.domReadyMs` | `events: page_performance.domReadyMs` |
| How to read it | Roughly when the page becomes usable. | تقريبًا متى تصبح الصفحة قابلة للاستخدام. |
| Limitation | A mean, not a percentile. | متوسط لا مئين. |

### Average full load — متوسط التحميل الكامل

`technical.load`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Mean time from navigation start until the load event finished (images included). | متوسط الوقت من بدء التنقل حتى انتهاء حدث التحميل (بما فيه الصور). |
| Counts | Sum of load times | مجموع أوقات التحميل |
| Divided by | Performance samples | عيّنات الأداء |
| Unit | milliseconds | مللي ثانية |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_performance.loadMs` | `events: page_performance.loadMs` |
| How to read it | Upper bound of the first-visit wait. | الحد الأعلى لانتظار الزيارة الأولى. |
| Limitation | A tab opened in the background finishes loading late and inflates it. | التبويب المفتوح في الخلفية يُنهي التحميل متأخرًا فيضخّمه. |

### Frontend errors — أخطاء الواجهة

`technical.errors`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Uncaught script errors and unhandled promise rejections, by error name and file. | أخطاء السكربت غير الملتقطة ورفض الوعود غير المعالج، حسب اسم الخطأ والملف. |
| Counts | Error events per error name and file | أحداث الخطأ لكل اسم خطأ وملف |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: client_error (.kind, .script)` | `events: client_error (.kind, .script)` |
| How to read it | A new name or a jump after a deploy is worth investigating. | ظهور اسم جديد أو قفزة بعد النشر يستحق التحقيق. |
| Limitation | No message and no stack are kept (they can carry user content); browser extensions can add noise. | لا تُحفظ الرسالة ولا تتبّع المكدس (قد يحملان محتوى المستخدم)؛ وإضافات المتصفح قد تضيف ضجيجًا. |

### Sessions by browser, device and language — الجلسات حسب المتصفح والجهاز واللغة

`technical.sessionsBy`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Sessions grouped by browser family, screen-width class and the site language last used. | الجلسات مجمّعة حسب عائلة المتصفح وفئة عرض الشاشة وآخر لغة استُخدمت في الموقع. |
| Counts | Sessions per value | الجلسات لكل قيمة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | sessions | جلسات |
| Aggregation | Count | عدد |
| Time window | Sessions active at any point inside the date filter | الجلسات النشطة في أي لحظة داخل مرشح التاريخ |
| Source | `sessions (browser_family, device_class, locale)` | `sessions (browser_family, device_class, locale)` |
| How to read it | Which browsers and screen sizes to test first. | أي المتصفحات وأحجام الشاشات تُختبر أولًا. |
| Limitation | Device class is screen width (under 640 px mobile, under 1024 px tablet), not the hardware. | فئة الجهاز هي عرض الشاشة (أقل من 640 بكسل جوال، وأقل من 1024 لوحي)، لا نوع الجهاز. |

### Page views by theme — مشاهدات الصفحات حسب المظهر

`technical.themeViews`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Page views grouped by the light or dark theme active when the page was shown. | مشاهدات الصفحات مجمّعة حسب المظهر الفاتح أو الداكن النشط عند عرض الصفحة. |
| Counts | Page views per theme | مشاهدات الصفحات لكل مظهر |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | events | أحداث |
| Aggregation | Count | عدد |
| Time window | Events whose time falls inside the date filter | الأحداث التي يقع وقتها داخل مرشح التاريخ |
| Source | `events: page_view.theme` | `events: page_view.theme` |
| How to read it | How much each theme matters for visual QA. | أهمية كل مظهر في الفحص البصري. |
| Limitation | Counts page views, not people; a theme switch mid-visit splits one visit. | يعدّ المشاهدات لا الأشخاص؛ وتبديل المظهر أثناء الزيارة يقسمها. |

## Content and data — المحتوى والبيانات

### City lookups — عمليات البحث عن المدن

`content.lookedUp`

| Field | English | العربية |
| --- | --- | --- |
| Definition | City descriptions looked up and cached, one per city and language. | أوصاف المدن التي بُحث عنها وخُزّنت، واحد لكل مدينة ولغة. |
| Counts | Rows in the description cache | الصفوف في مخزن الأوصاف |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | city lookups | عمليات بحث عن مدن |
| Aggregation | Count | عدد |
| Time window | Everything in the cache; the date filter does not apply | كل ما في المخزن؛ لا ينطبق عليه مرشح التاريخ |
| Source | `city_descriptions` | `city_descriptions` |
| How to read it | Grows as travellers open destination pages; not affected by the date filter. | يزداد كلما فتح المسافرون صفحات الوجهات؛ ولا يتأثر بمرشح التاريخ. |
| Limitation | A city nobody opened yet has no row, so this is not a coverage of the whole catalog. | المدينة التي لم يفتحها أحد بعد ليس لها صف، لذا هذا ليس تغطية للكتالوج كله. |

### With a verified description — بوصف موثّق

`content.verified`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Lookups that found an article whose own coordinates match the city. | عمليات البحث التي وجدت مقالًا تتطابق إحداثياته الخاصة مع المدينة. |
| Counts | Lookups with status ok | عمليات البحث بحالة موثّق |
| Divided by | City lookups | عمليات البحث عن المدن |
| Unit | city lookups | عمليات بحث عن مدن |
| Aggregation | Ratio | نسبة |
| Time window | Everything in the cache; the date filter does not apply | كل ما في المخزن؛ لا ينطبق عليه مرشح التاريخ |
| Source | `city_descriptions (status = ok)` | `city_descriptions (status = ok)` |
| How to read it | The share of opened cities that show a description. | نسبة المدن المفتوحة التي تعرض وصفًا. |
| Limitation | The coordinates are the article’s published ones, compared on the server; nothing about the traveller. | الإحداثيات هي المنشورة للمقال وتُقارن على الخادم؛ لا شيء يخص المسافر. |

### Countries with a lookup — دول لها عمليات بحث

`content.countriesSeen`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Distinct countries that have at least one city lookup. | الدول المميزة التي لها عملية بحث واحدة على الأقل عن مدينة. |
| Counts | Distinct country codes in the cache | رموز الدول المميزة في المخزن |
| Divided by | 194 destinations in the catalog | 194 وجهة في الكتالوج |
| Unit | countries | دول |
| Aggregation | Distinct count | عدد مميز |
| Time window | Everything in the cache; the date filter does not apply | كل ما في المخزن؛ لا ينطبق عليه مرشح التاريخ |
| Source | `city_descriptions.country_code` | `city_descriptions.country_code` |
| How to read it | How many destination pages have been opened at least once since the cache started. | عدد صفحات الوجهات التي فُتحت مرة واحدة على الأقل منذ بدء التخزين. |
| Limitation | An expired entry is looked up again but keeps its row, so this only grows. | الإدخال المنتهي يُبحث عنه من جديد لكنه يحتفظ بصفه، لذا هذا الرقم يزداد فقط. |

### Countries in the dataset — الدول في مجموعة البيانات

`intelligence.countriesCovered`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Countries in the bundled Country Intelligence dataset that powers “Best suited for” and Purpose Suitability. | الدول في مجموعة بيانات معلومات الدول المضمّنة التي تشغّل «الأنسب لـ» وملاءمة الغرض. |
| Counts | Distinct country codes in the snapshot | رموز الدول المميزة في اللقطة |
| Divided by | 194 destinations in the catalog | 194 وجهة في الكتالوج |
| Unit | countries | دول |
| Aggregation | Distinct count | عدد مميز |
| Time window | A bundled snapshot; the date filter does not apply | لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ |
| Source | `worker/src/generated/countryIntelligenceDetail.json` | `worker/src/generated/countryIntelligenceDetail.json` |
| How to read it | Should equal 194. Anything lower means the pipeline dropped countries. | يجب أن يساوي 194. أي رقم أقل يعني أن خط البيانات أسقط دولًا. |
| Limitation | A static file shipped with the server code; the date filter does not apply. | ملف ثابت يُشحن مع شيفرة الخادم؛ ولا ينطبق عليه مرشح التاريخ. |

### Dataset generated — تاريخ توليد البيانات

`intelligence.generatedAt`

| Field | English | العربية |
| --- | --- | --- |
| Definition | When the Country Intelligence pipeline last produced the dataset, and how many days ago that was. | متى أنتج خط معلومات الدول مجموعة البيانات آخر مرة، وكم يومًا مضى على ذلك. |
| Counts | The generation time recorded in the file | وقت التوليد المسجّل في الملف |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | date | تاريخ |
| Aggregation | Latest value | أحدث قيمة |
| Time window | A bundled snapshot; the date filter does not apply | لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ |
| Source | `countryIntelligenceDetail.json generatedAt` | `countryIntelligenceDetail.json generatedAt` |
| How to read it | Freshness. The underlying indicators are yearly; months old is expected, years old is not. | الحداثة. المؤشرات الأساسية سنوية؛ عمر أشهر متوقع، وعمر سنوات غير متوقع. |
| Limitation | The date of the build, not of each source’s latest release. | تاريخ البناء، لا تاريخ آخر إصدار لكل مصدر. |

### Countries with enough data — دول ببيانات كافية

`intelligence.sufficient`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Per purpose: countries with enough indicator coverage to show a suitability score. | لكل غرض: الدول التي تملك تغطية مؤشرات كافية لعرض درجة ملاءمة. |
| Counts | Countries not marked insufficient | الدول غير الموسومة بعدم الكفاية |
| Divided by | Countries in the dataset | الدول في مجموعة البيانات |
| Unit | countries | دول |
| Aggregation | Count | عدد |
| Time window | A bundled snapshot; the date filter does not apply | لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ |
| Source | `countryIntelligenceDetail.json insufficientData` | `countryIntelligenceDetail.json insufficientData` |
| How to read it | Below 60% coverage no score is computed; those countries show “not enough data” instead of a guessed score. | دون تغطية 60% لا تُحسب درجة؛ وتعرض تلك الدول «بيانات غير كافية» بدل درجة مخمَّنة. |
| Limitation | Enough data is a methodology threshold, not a quality grade of the country. | كفاية البيانات عتبة منهجية، لا تقدير لجودة الدولة. |

### Average indicator coverage — متوسط تغطية المؤشرات

`intelligence.averageCoverage`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Per purpose: mean share of the purpose’s factors actually observed for a country. | لكل غرض: متوسط نسبة عوامل الغرض المرصودة فعلًا للدولة. |
| Counts | Sum of per-country coverage | مجموع التغطية لكل دولة |
| Divided by | Countries in the dataset | الدول في مجموعة البيانات |
| Unit | percent | نسبة مئوية |
| Aggregation | Arithmetic mean | متوسط حسابي |
| Time window | A bundled snapshot; the date filter does not apply | لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ |
| Source | `countryIntelligenceDetail.json coverage` | `countryIntelligenceDetail.json coverage` |
| How to read it | Higher means fewer gaps behind the scores. | الارتفاع يعني فجوات أقل خلف الدرجات. |
| Limitation | Coverage is measured, not imputed: a missing indicator stays missing. | التغطية مقيسة لا مقدّرة: المؤشر المفقود يبقى مفقودًا. |

### High-confidence countries — دول بثقة عالية

`intelligence.highConfidence`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Per purpose: countries rated high confidence — coverage of at least 90% and an average data age of 3 years or less. | لكل غرض: الدول ذات الثقة العالية — تغطية 90% على الأقل ومتوسط عمر بيانات 3 سنوات أو أقل. |
| Counts | Countries with confidence high | الدول بثقة عالية |
| Divided by | Countries in the dataset | الدول في مجموعة البيانات |
| Unit | countries | دول |
| Aggregation | Count | عدد |
| Time window | A bundled snapshot; the date filter does not apply | لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ |
| Source | `countryIntelligenceDetail.json confidence` | `countryIntelligenceDetail.json confidence` |
| How to read it | Where the suitability scores are most trustworthy. | حيث تكون درجات الملاءمة أجدر بالثقة. |
| Limitation | Confidence describes the data behind a score, not how good the country is. | الثقة تصف البيانات خلف الدرجة، لا مدى جودة الدولة. |

## Reports and feedback — البلاغات والملاحظات

### Matching reports — البلاغات المطابقة

`reports.matching`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Reports that match the filters above and the search, status, type and screenshot choices. | البلاغات المطابقة لعوامل التصفية أعلاه ولاختيارات البحث والحالة والنوع ولقطة الشاشة. |
| Counts | Matching feedback rows | صفوف الملاحظات المطابقة |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | reports | بلاغات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `feedback` | `feedback` |
| How to read it | Status and type counts below describe the same matching set. | أعداد الحالات والأنواع أدناه تصف المجموعة المطابقة نفسها. |
| Limitation | The search looks inside the message, the reference and the country code only. | البحث يشمل الرسالة والمرجع ورمز الدولة فقط. |

### With a screenshot — مع لقطة شاشة

`reports.withScreenshot`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Matching reports that arrived with a screenshot attached. | البلاغات المطابقة التي وصلت مع لقطة شاشة مرفقة. |
| Counts | Matching reports with a stored screenshot | البلاغات المطابقة التي لها لقطة مخزّنة |
| Divided by | Matching reports | البلاغات المطابقة |
| Unit | reports | بلاغات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `feedback.screenshot_key` | `feedback.screenshot_key` |
| How to read it | Visual bugs are usually easier to act on with a screenshot. | الأخطاء البصرية أسهل معالجة عادةً مع لقطة شاشة. |
| Limitation | The dashboard shows only that a screenshot exists; the image stays in private storage. | تُظهر اللوحة وجود اللقطة فقط؛ وتبقى الصورة في تخزين خاص. |

### Rating comments — تعليقات التقييم

`reports.ratingComments`

| Field | English | العربية |
| --- | --- | --- |
| Definition | Ratings that came with a written comment, newest first. | التقييمات المصحوبة بتعليق مكتوب، الأحدث أولًا. |
| Counts | Ratings with a non-empty comment | التقييمات ذات التعليق غير الفارغ |
| Divided by | Nothing — a plain count | لا شيء — عدد مباشر |
| Unit | ratings | تقييمات |
| Aggregation | Count | عدد |
| Time window | Rows created inside the date filter | الصفوف المنشأة داخل مرشح التاريخ |
| Source | `ratings.comment` | `ratings.comment` |
| How to read it | The travellers’ own words next to their score. | كلمات المسافرين أنفسهم بجانب درجاتهم. |
| Limitation | Shown as written; never mined, classified or translated. | تُعرض كما كُتبت؛ دون تنقيب أو تصنيف أو ترجمة. |
