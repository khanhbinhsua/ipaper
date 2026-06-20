const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageNumber, Header, Footer, PageBreak, VerticalAlign, ImageRun,
} = require('docx');
const path = require('path');

// Ảnh minh họa: chèn screenshot + chú thích
function img(file, caption, widthPx = 600) {
  const data = fs.readFileSync(path.join(__dirname, 'shots', file));
  const h = Math.round(widthPx / (2049 / 1230)); // giữ tỉ lệ ảnh gốc
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({
        type: 'png', data,
        transformation: { width: widthPx, height: h },
        altText: { title: caption, description: caption, name: file },
      })],
    }),
  ];
  if (caption) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: 'Hình: ' + caption, italics: true, size: 18, color: '777777' })],
    }));
  }
  return out;
}

const RED = 'C8102E';
const DARK = '1A1A2E';
const GRAY = '666666';

// ---------- helpers ----------
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, ...opts })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 60 },
    children: Array.isArray(text) ? text : [new TextRun(text)],
  });
}
function step(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'steps', level },
    spacing: { after: 60 },
    children: Array.isArray(text) ? text : [new TextRun(text)],
  });
}
function b(text) { return new TextRun({ text, bold: true }); }
function t(text) { return new TextRun(text); }

// table helper: rows = array of array of strings; header row shaded red
function table(widths, rows, headerFill = RED) {
  const total = widths.reduce((a, c) => a + c, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, ri) =>
      new TableRow({
        tableHeader: ri === 0,
        children: cells.map((cell, ci) =>
          new TableCell({
            borders,
            width: { size: widths[ci], type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            shading: ri === 0
              ? { fill: headerFill, type: ShadingType.CLEAR }
              : { fill: ci === 0 ? 'F7F7F7' : 'FFFFFF', type: ShadingType.CLEAR },
            children: [new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({
                text: cell,
                bold: ri === 0,
                color: ri === 0 ? 'FFFFFF' : '000000',
                size: 20,
              })],
            })],
          })
        ),
      })
    ),
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    shading: { fill: 'FFF4E5', type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'F59A23', space: 8 } },
    children: [new TextRun({ text: '⚠ Lưu ý: ', bold: true, color: 'B26A00' }), new TextRun({ text, color: '5C4A00' })],
  });
}

// ===================== CONTENT =====================
const children = [];

// Cover
children.push(
  new Paragraph({ spacing: { before: 2600, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'iPaper', bold: true, size: 96, color: RED })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: 'HỆ THỐNG QUẢN LÝ LUỒNG VĂN BẢN ĐIỆN TỬ', bold: true, size: 32, color: DARK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: 'Tài liệu Mô tả Tính năng & Hướng dẫn Sử dụng', size: 26, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
    children: [new TextRun({ text: 'Dành cho toàn thể nhân viên', italics: true, size: 24, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1800 },
    children: [new TextRun({ text: 'Phiên bản 1.0', size: 22, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Truy cập: https://ipaper.vitaliahmd.com', size: 22, color: RED })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// TOC
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Mục lục')] }),
  new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---- Phần 1: Giới thiệu ----
children.push(h1('1. Giới thiệu chung'));
children.push(p('iPaper là hệ thống số hóa quy trình trình ký, phê duyệt và lưu trữ văn bản trong nội bộ tổ chức. Hệ thống thay thế hồ sơ giấy bằng hồ sơ điện tử (eform), áp dụng quy trình phê duyệt nhiều cấp, giúp tiết kiệm thời gian, giảm in ấn và tra cứu thông tin nhanh chóng.'));
children.push(h2('1.1. Lợi ích chính'));
children.push(bullet('Trình ký, duyệt văn bản mọi lúc mọi nơi qua trình duyệt web.'));
children.push(bullet('Theo dõi trạng thái hồ sơ theo thời gian thực, có thông báo tức thời.'));
children.push(bullet('Lưu vết toàn bộ lịch sử phê duyệt; khi hoàn thành tự sinh trang lịch sử đính kèm vào file PDF.'));
children.push(bullet('Đính kèm, xem và tải tài liệu (PDF, Word, Excel...) trực tiếp.'));
children.push(bullet('Phân quyền rõ ràng theo vai trò: Nhân viên, Trưởng phòng, Ban giám đốc, Quản trị.'));
children.push(h2('1.2. Truy cập hệ thống'));
children.push(table([2600, 6760], [
  ['Mục', 'Thông tin'],
  ['Địa chỉ web', 'https://ipaper.vitaliahmd.com'],
  ['Trình duyệt khuyến nghị', 'Google Chrome, Microsoft Edge, Cốc Cốc (bản mới)'],
  ['Thông tin đăng nhập', 'Mã tổ chức + Tên đăng nhập + Mật khẩu (do Quản trị cấp)'],
]));
children.push(note('Mỗi nhân viên được Quản trị tạo sẵn tài khoản. Lần đầu đăng nhập nên đổi mật khẩu ngay.'));

// ---- Phần 2: Đối tượng & vai trò ----
children.push(h1('2. Vai trò người dùng'));
children.push(p('Hệ thống có 4 vai trò. Mỗi vai trò thấy chức năng phù hợp với nhiệm vụ của mình:'));
children.push(table([2400, 6960], [
  ['Vai trò', 'Quyền hạn chính'],
  ['Nhân viên', 'Tạo hồ sơ, gửi duyệt, điều phối hồ sơ lên cấp trên, hoàn thành hồ sơ, đăng ký nghỉ phép.'],
  ['Trưởng phòng', 'Như nhân viên + duyệt / từ chối / trả về hồ sơ được giao.'],
  ['Ban giám đốc', 'Duyệt cấp cao nhất trong quy trình phê duyệt.'],
  ['Quản trị (Admin)', 'Tạo / sửa / khóa tài khoản người dùng, quản lý hệ thống.'],
]));

// ---- Phần 3: Mô tả tính năng ----
children.push(h1('3. Mô tả chi tiết tính năng'));

children.push(h2('3.1. Đăng nhập & Tài khoản'));
children.push(bullet('Đăng nhập bằng Mã tổ chức, Tên đăng nhập, Mật khẩu.'));
children.push(bullet('Đổi mật khẩu cá nhân (yêu cầu: có chữ hoa, số, ký tự đặc biệt, tối thiểu 7 ký tự).'));
children.push(bullet('Thông tin cá nhân: ảnh đại diện, bộ phận, bật/tắt nhận thông báo trên hệ thống & qua email.'));

children.push(h2('3.2. Màn hình Thống kê (Trang chủ)'));
children.push(bullet('Bộ đếm nhanh: Hồ sơ đến, Hồ sơ đi, Hồ sơ nháp, Hồ sơ liên quan.'));
children.push(bullet('Biểu đồ trạng thái hồ sơ: Đã duyệt / Chưa duyệt / Từ chối.'));
children.push(bullet('Lọc theo khoảng thời gian.'));
children.push(...img('02-dashboard.png', 'Màn hình Thống kê (Trang chủ)'));

children.push(h2('3.3. Quản lý hồ sơ'));
children.push(table([2600, 6760], [
  ['Loại', 'Ý nghĩa'],
  ['Hồ sơ đến', 'Hồ sơ đang chờ bạn xử lý / phê duyệt.'],
  ['Hồ sơ đi', 'Hồ sơ bạn đã thao tác (gửi, duyệt, xử lý).'],
  ['Hồ sơ nháp', 'Hồ sơ đã lưu nhưng chưa gửi duyệt.'],
  ['Hồ sơ liên quan', 'Hồ sơ bạn chỉ được xem (người liên quan / CC).'],
  ['Tìm hồ sơ', 'Tìm kiếm theo tiêu đề, loại yêu cầu, ưu tiên, trạng thái, ngày...'],
]));
children.push(...img('03-inbox.png', 'Danh sách Hồ sơ đến'));

children.push(h2('3.4. Quy trình phê duyệt nhiều cấp'));
children.push(p('Hồ sơ được điều phối bởi người tạo (nhân viên), đi qua từng cấp duyệt cho đến khi hoàn thành:'));
children.push(p('Nhân viên tạo → gửi Trưởng phòng → (duyệt) quay về Nhân viên → gửi Ban giám đốc → (duyệt) quay về Nhân viên → Nhân viên bấm "Hoàn thành".', { italics: true, color: GRAY }));
children.push(bullet([b('Duyệt: '), t('đồng ý, hồ sơ quay về người tạo để gửi tiếp cấp trên hoặc hoàn thành.')]));
children.push(bullet([b('Từ chối: '), t('kết thúc quy trình, ghi lý do.')]));
children.push(bullet([b('Trả về: '), t('trả hồ sơ về người tạo để bổ sung; người tạo có nút "Trình lại".')]));
children.push(bullet([b('Hoàn thành: '), t('người tạo kết thúc; hệ thống tự sinh trang Lịch sử phê duyệt nối vào cuối file PDF đính kèm.')]));
children.push(...img('04-document-detail.png', 'Màn hình chi tiết hồ sơ với các nút Duyệt / Từ chối / Trả về'));

children.push(h2('3.5. Tài liệu đính kèm'));
children.push(bullet('Tải lên file (PDF, Word, Excel, ảnh...), tối đa 25MB / file.'));
children.push(bullet('Xem PDF trực tiếp trong app (không cần tải về).'));
children.push(bullet('Tải file về máy (giữ đúng tên tiếng Việt).'));

children.push(h2('3.6. Thông báo thời gian thực'));
children.push(bullet('Chuông thông báo hiển thị số hồ sơ mới cần xử lý.'));
children.push(bullet('Cập nhật tức thời khi có hồ sơ chuyển đến / được duyệt / bị trả về (không cần tải lại trang).'));

children.push(h2('3.7. Đăng ký nghỉ phép'));
children.push(bullet('Tạo đơn nghỉ: loại nghỉ, từ ngày – đến ngày, nghỉ nửa buổi sáng/chiều, chọn người duyệt.'));
children.push(bullet('Xem đơn của tôi & duyệt đơn của cấp dưới.'));
children.push(...img('07-leave.png', 'Màn hình Đăng ký nghỉ phép'));

children.push(h2('3.8. Tạo theo mẫu'));
children.push(bullet('Chọn biểu mẫu có sẵn theo danh mục để tạo hồ sơ nhanh (điền sẵn loại yêu cầu).'));

children.push(h2('3.9. Quản trị người dùng (chỉ Admin)'));
children.push(bullet('Tạo tài khoản: tên đăng nhập, email, họ tên, bộ phận, vai trò, mật khẩu.'));
children.push(bullet('Sửa thông tin, đổi vai trò, đặt lại mật khẩu, khóa/mở tài khoản.'));
children.push(...img('09-admin-users.png', 'Màn hình Quản trị người dùng (chỉ Admin)'));

// ---- Phần 4: Hướng dẫn sử dụng ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('4. Hướng dẫn sử dụng theo thao tác'));

children.push(h2('4.1. Đăng nhập'));
children.push(step('Mở trình duyệt, truy cập https://ipaper.vitaliahmd.com'));
children.push(step('Nhập đủ 3 ô: Mã tổ chức, Tên đăng nhập, Mật khẩu.'));
children.push(step('Bấm "Đăng nhập".'));
children.push(...img('01-login.png', 'Màn hình đăng nhập', 420));
children.push(note('Bắt buộc nhập ô "Mã tổ chức" — nếu để trống sẽ không đăng nhập được.'));

children.push(h2('4.2. Đổi mật khẩu'));
children.push(step('Bấm vào ảnh đại diện (góc trên bên phải) → "Đổi mật khẩu".'));
children.push(step('Nhập mật khẩu hiện tại, mật khẩu mới (đủ điều kiện), xác nhận lại.'));
children.push(step('Bấm "Lưu".'));

children.push(h2('4.3. Nhân viên: Tạo và gửi hồ sơ'));
children.push(step('Menu trái → "Tạo yêu cầu" (hoặc "Tạo yêu cầu theo mẫu").'));
children.push(step('Điền: Tiêu đề, Loại yêu cầu, Ưu tiên, Bộ phận, Thời hạn.'));
children.push(step('Ô "Chuyển tới": gõ tên/email người duyệt đầu tiên (vd Trưởng phòng) để chọn.'));
children.push(step('Đính kèm tài liệu (nên dùng PDF để có trang lịch sử khi hoàn thành).'));
children.push(step('Bấm "Gửi duyệt" (hoặc "Lưu" để lưu nháp).'));
children.push(...img('05-create.png', 'Màn hình Tạo yêu cầu'));

children.push(h2('4.4. Trưởng phòng / Giám đốc: Duyệt hồ sơ'));
children.push(step('Menu trái → "Hồ sơ đến".'));
children.push(step('Bấm vào hồ sơ cần xử lý để mở chi tiết.'));
children.push(step('Xem nội dung, tài liệu đính kèm.'));
children.push(step('Chọn: "Duyệt" / "Từ chối" / "Trả về", nhập ý kiến rồi xác nhận.'));
children.push(note('Hồ sơ sau khi duyệt sẽ tự chuyển vào "Hồ sơ đi" của người duyệt và quay về người tạo để điều phối tiếp.'));

children.push(h2('4.5. Nhân viên: Điều phối & Hoàn thành'));
children.push(step('Sau khi cấp dưới đã duyệt, hồ sơ quay lại "Hồ sơ đến" của bạn.'));
children.push(step('Mở chi tiết hồ sơ:'));
children.push(step('Bấm "Gửi duyệt tiếp" → chọn cấp cao hơn (vd Giám đốc) nếu cần duyệt thêm.', 1));
children.push(step('Hoặc bấm "Hoàn thành" khi đã duyệt xong tất cả các cấp.', 1));
children.push(step('Khi "Hoàn thành": hệ thống sinh trang Lịch sử phê duyệt và nối vào cuối file PDF.'));

children.push(h2('4.6. Hồ sơ bị trả về: Trình lại'));
children.push(step('Hồ sơ bị "Trả về" sẽ xuất hiện ở "Hồ sơ đến" của người tạo.'));
children.push(step('Mở chi tiết → bổ sung tài liệu/thông tin nếu cần.'));
children.push(step('Bấm "Trình lại" → chọn người duyệt → gửi lại.'));

children.push(h2('4.7. Xem & tải tài liệu'));
children.push(step('Mở chi tiết hồ sơ → tab "Tài liệu bổ sung".'));
children.push(step('Bấm "Xem" (với PDF) để xem ngay trong app, hoặc "Tải" để tải về máy.'));

children.push(h2('4.8. Đăng ký nghỉ phép'));
children.push(step('Menu trái → "Đăng ký nghỉ" → tab "Tạo đơn".'));
children.push(step('Chọn loại nghỉ, khoảng ngày, nửa buổi (nếu có), người duyệt.'));
children.push(step('Bấm "Gửi duyệt". Theo dõi ở tab "Đơn của tôi".'));

children.push(h2('4.9. Quản trị: Tạo tài khoản nhân viên (Admin)'));
children.push(step('Menu trái → "Quản trị người dùng".'));
children.push(step('Bấm "Tạo tài khoản".'));
children.push(step('Điền tên đăng nhập, email, họ tên, bộ phận, chọn vai trò, đặt mật khẩu.'));
children.push(step('Bấm "Lưu". Gửi thông tin đăng nhập cho nhân viên.'));
children.push(...img('08-templates.png', 'Màn hình Tạo yêu cầu theo mẫu'));

// ---- Phần 5: Câu hỏi thường gặp ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('5. Câu hỏi thường gặp (FAQ)'));
children.push(table([3400, 5960], [
  ['Câu hỏi', 'Giải đáp'],
  ['Bấm đăng nhập không phản hồi?', 'Kiểm tra đã nhập đủ ô "Mã tổ chức" chưa.'],
  ['Không thấy hồ sơ cần duyệt?', 'Vào "Hồ sơ đến"; hồ sơ chỉ hiện khi được chuyển tới đúng bạn.'],
  ['Quên mật khẩu?', 'Liên hệ Quản trị (Admin) để đặt lại.'],
  ['File tải về bị lỗi tên?', 'Hệ thống hỗ trợ tên tiếng Việt; nếu lỗi hãy thử trình duyệt Chrome/Edge bản mới.'],
  ['Trang lịch sử phê duyệt ở đâu?', 'Sau khi "Hoàn thành", mở file PDF đính kèm — trang cuối là lịch sử phê duyệt.'],
]));

children.push(h1('6. Liên hệ hỗ trợ'));
children.push(p('Khi gặp sự cố, vui lòng liên hệ bộ phận Quản trị hệ thống của tổ chức để được hỗ trợ kịp thời.'));

// ===================== DOC =====================
const doc = new Document({
  creator: 'iPaper',
  title: 'iPaper - Hướng dẫn sử dụng',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: '222222' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: RED },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: RED, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: '444444' },
        paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1100, hanging: 280 } } } },
      ]},
      { reference: 'steps', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: 'Bước %1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 800, hanging: 520 } } } },
        { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1300, hanging: 360 } } } },
      ]},
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, right: 1300, bottom: 1300, left: 1300 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'iPaper — Hướng dẫn sử dụng', size: 16, color: GRAY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Trang ', size: 16, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('iPaper-Huong-dan-su-dung.docx', buf);
  console.log('DONE: iPaper-Huong-dan-su-dung.docx', buf.length, 'bytes');
});
