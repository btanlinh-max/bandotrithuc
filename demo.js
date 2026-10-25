/* Bản dùng thử: chạy toàn bộ trên trình duyệt, dữ liệu mẫu lưu trong máy này (localStorage). */
var Demo = (function () {
  var KEY = "bdtt_demo_v1";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("Không lưu được dữ liệu mẫu", e); } }
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  var db = load();
  function ensure() { if (!db) { db = seed(); save(db); } return db; }
  var adapter = {
    all: function (t) { return JSON.parse(JSON.stringify(ensure()[t] || [])); },
    put: function (t, r) { var a = ensure()[t] = ensure()[t] || [], i = a.findIndex(function (x) { return x.id === r.id; }); if (i < 0) a.push(r); else a[i] = r; save(db); },
    del: function (t, id) { ensure()[t] = (ensure()[t] || []).filter(function (x) { return x.id !== id; }); save(db); },
    secret: function (k, v) { var s = ensure().secret = ensure().secret || {}; if (v === undefined) return s[k] || ""; s[k] = v; save(db); },
    sign: function (s) { return fnv("demo|" + s); },
    hash: function (s) { return fnv("pw|" + s); },
    putFile: function (name, b64) { var f = ensure().files = ensure().files || {}, id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); f[id] = b64; save(db); return id; },
    getFile: function (id) { return (ensure().files || {})[id] || null; }
  };

  /* AI ở bản dùng thử: có mã Gemini (nhập ở Cài đặt) thì gọi thật, không có thì trả câu mẫu */
  async function ai(parts, json) {
    var key = adapter.secret("key");
    var text = parts[0].text;
    if (key) {
      var models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"], last;
      for (var i = 0; i < models.length; i++) {
        var res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + models[i] + ":generateContent", { method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ role: "user", parts: parts }], generationConfig: json ? { temperature: .5, responseMimeType: "application/json" } : { temperature: .5 } }) });
        if (res.status === 404) { last = new Error("Không tìm thấy mô hình AI."); continue; }
        if (!res.ok) { var m = ""; try { m = (await res.json()).error.message; } catch (e) {} throw new Error("Mã AI chưa dùng được (Google báo " + res.status + ": " + m + ")."); }
        var d = await res.json();
        return ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.text || ""; }).join("");
      }
      throw last;
    }
    await new Promise(function (r) { setTimeout(r, 900); });
    if (/mục lục/.test(text)) return JSON.stringify([{ topic: "Chủ đề mẫu", title: "Bài mẫu 1" }, { topic: "Chủ đề mẫu", title: "Bài mẫu 2" }]);
    if (/CHẤM NHÁP/.test(text)) {
      var items = JSON.parse(text.split("\n").find(function (l) { return l.charAt(0) === "["; }) || "[]");
      return JSON.stringify({ items: items.map(function (it) { var empty = !it.photo && (!it.bai_lam || it.bai_lam === "(bỏ trống)");
        return { qid: it.qid, score: empty ? 0 : it.diem_toi_da, comment: empty ? "Em chưa làm câu này, em thử làm lại nhé." : "Em trình bày rõ ràng, cô khen em!", note: "(Bản dùng thử: điểm gợi ý mẫu)" }; }),
        overall: "Em làm bài chăm chỉ. Cô khen em, cố gắng giữ vở sạch chữ đẹp nhé!" });
    }
    var tv = /Môn: Tiếng Việt/.test(text);
    return JSON.stringify(tv ? SAMPLE_TV : SAMPLE_TOAN);
  }
  var SAMPLE_TOAN = [
    { type: "mcq", level: 1, text: "Kết quả của phép tính 6 × 4 là:", options: ["10", "20", "24", "28"], answer: 2, points: 1, explain: "6 × 4 = 24 (6 được lấy 4 lần)." },
    { type: "fill", level: 1, text: "Điền số thích hợp: 35 : 5 = …", answer: "7", points: 1, explain: "Vì 5 × 7 = 35 nên 35 : 5 = 7." },
    { type: "tf", level: 2, text: "Đúng hay sai: 8 × 3 = 3 × 8", answer: true, points: 1, explain: "Đổi chỗ các thừa số thì tích không đổi." },
    { type: "mcq", level: 2, text: "Mẹ xếp 28 quả trứng vào các khay, mỗi khay 4 quả. Mẹ xếp được mấy khay?", options: ["6 khay", "7 khay", "8 khay", "24 khay"], answer: 1, points: 1, explain: "28 : 4 = 7 (khay)." },
    { type: "fill", level: 2, text: "Lớp em có 5 tổ, mỗi tổ có 7 bạn. Lớp em có … bạn.", answer: "35|35 bạn", points: 1, explain: "5 × 7 = 35 (bạn)." },
    { type: "photo", level: 3, text: "Ông trồng 6 hàng cây cam, mỗi hàng 9 cây. Ông đã bán đi 15 cây. Hỏi ông còn lại bao nhiêu cây cam? Em làm vào vở rồi chụp ảnh nộp.", answer: "Số cây cam ông trồng: 6 × 9 = 54 (cây). Số cây còn lại: 54 − 15 = 39 (cây). Đáp số: 39 cây cam.", rubric: "Bước 1 đúng: 1 điểm; bước 2 đúng và có đáp số: 1 điểm.", points: 2, explain: "Tính số cây trồng trước, rồi trừ số cây đã bán." }
  ];
  var SAMPLE_TV = [
    { type: "mcq", level: 1, text: "Từ nào chỉ hoạt động?", options: ["sân trường", "nhảy dây", "xanh mát", "cái bàn"], answer: 1, points: 1, explain: "\"Nhảy dây\" là việc các bạn làm, nên là từ chỉ hoạt động." },
    { type: "fill", level: 1, text: "Điền \"tr\" hoặc \"ch\": …ăm chỉ học bài", answer: "ch|chăm", points: 1, explain: "Viết đúng là \"chăm chỉ\"." },
    { type: "tf", level: 2, text: "Đúng hay sai: Câu \"Bạn Lan đang tưới cây.\" là câu kể một hoạt động.", answer: true, points: 1, explain: "Câu nói về việc bạn Lan đang làm." },
    { type: "short", level: 2, text: "Em hãy đặt một câu nói về một việc em làm để giúp bố mẹ.", answer: "Ví dụ: Em quét nhà giúp mẹ.", rubric: "Câu đủ ý, có từ chỉ hoạt động, có dấu chấm cuối câu: 1 điểm.", points: 1, explain: "Câu cần nói rõ ai làm gì." },
    { type: "photo", level: 3, text: "Viết 3–4 câu kể về một buổi sáng ở trường em. Em viết vào vở rồi chụp ảnh nộp.", answer: "Đoạn văn kể đúng buổi sáng ở trường, có cảm nghĩ của em.", rubric: "Đúng chủ đề: 1 điểm; câu rõ ràng, đúng chính tả, có dấu câu: 1 điểm.", points: 2, explain: "Kể theo thứ tự: đến trường, chào cờ hoặc vào lớp, cảm nghĩ." }
  ];

  function seed() {
    var d = { settings: [], students: [], lessons: [], asgs: [], subs: [], log: [], secret: { pw: fnv("pw|" + "demo123") }, files: {} };
    d.settings.push({ id: "main", className: "3A", teacherName: "Cô giáo lớp 3A", school: "Trường Tiểu học (bản dùng thử)", classCode: "DEMO3A", autoReturn: true,
      subjects: [{ id: "toan", name: "Toán" }, { id: "tv", name: "Tiếng Việt" }] });
    var names = ["Nguyễn Minh An", "Trần Bảo Anh", "Lê Gia Bảo", "Phạm Ngọc Diệp", "Hoàng Đức Duy", "Vũ Thu Hà", "Đặng Quang Huy", "Bùi Khánh Linh", "Đỗ Hải Nam", "Ngô Phương Thảo", "Dương Tuấn Kiệt", "Lý Mai Chi"];
    var av = ["🦁", "🐰", "🐯", "🦋", "🐻", "🐱", "🦊", "🐼", "🐬", "🌻", "🚀", "🐨"];
    names.forEach(function (n, i) { d.students.push({ id: "hs" + (i + 1), name: n, avatar: av[i], pin: "1234", order: i }); });
    var toan = [["Ôn tập và bổ sung", ["Ôn tập các số đến 1000", "Ôn tập phép cộng, phép trừ", "Tìm thành phần trong phép cộng, phép trừ"]],
      ["Bảng nhân, bảng chia", ["Bảng nhân 3, bảng chia 3", "Bảng nhân 4, bảng chia 4", "Bảng nhân 6, bảng chia 6", "Bảng nhân 7, bảng chia 7", "Bảng nhân 8, bảng chia 8", "Bảng nhân 9, bảng chia 9"]],
      ["Làm quen với hình phẳng, hình khối", ["Điểm ở giữa, trung điểm", "Hình tròn", "Khối lập phương, khối hộp chữ nhật"]],
      ["Phép nhân, phép chia trong phạm vi 100", ["Nhân số có hai chữ số với số có một chữ số", "Phép chia hết, phép chia có dư", "Chia số có hai chữ số cho số có một chữ số"]]];
    var tv = [["Những trải nghiệm thú vị", ["Ngày gặp lại", "Về thăm quê", "Cánh rừng trong nắng", "Lần đầu ra biển"]],
      ["Cổng trường rộng mở", ["Ngày khai trường", "Lời giải toán đặc biệt", "Bài tập làm văn", "Nhớ lại buổi đầu đi học"]]];
    var o = 0;
    function addL(subj, list, prefix) { list.forEach(function (t, ti) { t[1].forEach(function (title, li) { d.lessons.push({ id: prefix + ti + "_" + li, subject: subj, topic: t[0], title: title, order: o++ }); }); }); }
    addL("toan", toan, "t"); addL("tv", tv, "v");
    var day = function (k) { var x = new Date(Date.now() + k * 864e5); return x.toISOString().slice(0, 10); };
    function q(id, x) { return Object.assign({ id: id, ai: true }, x); }
    var a1 = { id: "a1", title: "Luyện tập bảng nhân 3, bảng chia 3", subject: "toan", lessonId: "t1_0", due: day(-3), target: "all", status: "giao", createdAt: day(-6), questions: [
      q("a1q1", { type: "mcq", level: 1, text: "3 × 7 = ?", options: ["18", "21", "24", "27"], answer: 1, points: 1, explain: "3 × 7 = 21." }),
      q("a1q2", { type: "fill", level: 1, text: "27 : 3 = …", answer: "9", points: 1, explain: "Vì 3 × 9 = 27." }),
      q("a1q3", { type: "tf", level: 2, text: "Đúng hay sai: 3 × 6 lớn hơn 3 × 5 đúng 3 đơn vị.", answer: true, points: 1, explain: "Thêm 1 lần 3 thì tích tăng 3." }),
      q("a1q4", { type: "fill", level: 2, text: "Có 24 cái bánh chia đều vào 3 hộp. Mỗi hộp có … cái bánh.", answer: "8|8 cái", points: 1, explain: "24 : 3 = 8." }),
      q("a1q5", { type: "mcq", level: 3, text: "Bà có 3 rổ cam, mỗi rổ 8 quả. Bà biếu hàng xóm 4 quả. Bà còn mấy quả?", options: ["20 quả", "24 quả", "28 quả", "11 quả"], answer: 0, points: 1, explain: "3 × 8 = 24; 24 − 4 = 20 (quả)." })] };
    var a2 = { id: "a2", title: "Bảng nhân 4 – bài về nhà", subject: "toan", lessonId: "t1_1", due: day(2), target: "all", status: "giao", createdAt: day(-1), questions: SAMPLE_TOAN.map(function (x, i) { return q("a2q" + i, x); }) };
    var a3 = { id: "a3", title: "Ngày gặp lại – luyện từ và câu", subject: "tv", lessonId: "v0_0", due: day(1), target: "all", status: "giao", createdAt: day(-2), questions: SAMPLE_TV.map(function (x, i) { return q("a3q" + i, x); }) };
    var a0 = { id: "a0", title: "Ôn tập các số đến 1000", subject: "toan", lessonId: "t0_0", due: day(-9), target: "all", status: "giao", createdAt: day(-11), questions: [
      q("a0q1", { type: "mcq", level: 1, text: "Số gồm 4 trăm, 0 chục, 7 đơn vị là:", options: ["47", "407", "470", "4007"], answer: 1, points: 1, explain: "4 trăm, 0 chục, 7 đơn vị viết là 407." }),
      q("a0q2", { type: "fill", level: 2, text: "Số liền sau của 599 là …", answer: "600", points: 1, explain: "599 + 1 = 600." })] };
    d.asgs.push(a0, a1, a2, a3);
    var scores = [10, 10, 8, 9, 6, 10, 8, 10, 7, 9, 10, 8];
    d.students.forEach(function (s, i) {
      d.subs.push({ id: "s0_" + i, aid: "a0", sid: s.id, answers: {}, auto: {}, ai: {}, status: "da_tra", score10: 10, stars: 3, reviewer: "tu_dong", submittedAt: day(-10), teacherComment: "Em làm rất tốt! Cô khen em, tiếp tục phát huy nhé." });
      if (i < 11) { var sc = scores[i], k = Math.round(sc / 2), ans = {}, au = {}, fi = {};
        a1.questions.forEach(function (qq, j) { var ok = j < k; au[qq.id] = ok; fi[qq.id] = ok ? 1 : 0;
          ans[qq.id] = qq.type === "mcq" ? (ok ? qq.answer : (qq.answer + 1) % 4) : qq.type === "tf" ? String(ok ? qq.answer : !qq.answer) : (ok ? String(qq.answer).split("|")[0] : "6"); });
        d.subs.push({ id: "s1_" + i, aid: "a1", sid: s.id, answers: ans, auto: au, final: fi, ai: {}, status: "da_tra", score10: sc, stars: sc >= 9 ? 3 : sc >= 7 ? 2 : 1, reviewer: "tu_dong", submittedAt: day(-4), teacherComment: sc >= 9 ? "Em làm rất tốt! Cô khen em, tiếp tục phát huy nhé." : "Em làm khá tốt. Xem lại những câu sai để lần sau đúng hết nhé." }); }
    });
    [1, 3, 5].forEach(function (i) {
      d.subs.push({ id: "s3_" + i, aid: "a3", sid: "hs" + i, answers: { a3q0: 1, a3q1: "ch", a3q2: "true", a3q3: ["Em quét nhà giúp mẹ.", "Em tưới cây cho bà.", "Em rửa bát giúp mẹ sau bữa tối."][i % 3] },
        auto: { a3q0: true, a3q1: true, a3q2: true }, photos: {}, ai: { a3q3: { score: 1, comment: "Câu của em đủ ý và có dấu chấm, cô khen em!", note: "Câu đúng mẫu Ai làm gì." }, a3q4: { score: null, comment: "", note: "Em chưa gửi ảnh bài viết." } },
        aiOverall: "Em làm phần luyện từ và câu rất tốt. Em nhớ chụp ảnh đoạn văn gửi cô nhé!", draft10: 6, needCheck: true, status: "cho_duyet", submittedAt: day(0) });
    });
    return d;
  }
  return { adapter: adapter, ai: ai, reset: function () { db = seed(); save(db); }, password: "demo123" };
})();
