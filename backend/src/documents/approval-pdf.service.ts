import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { Document } from './document.entity';
import { ApprovalAction } from './approval.entity';

const ACTION_LABEL: Record<string, string> = {
  submit: 'Gửi duyệt',
  approve: 'Duyệt',
  reject: 'Từ chối',
  return: 'Trả về',
  save_draft: 'Lưu nháp',
  complete: 'Hoàn thành',
};

const RED = rgb(0.792, 0.0, 0.118); // #CA001E ~ đỏ HDBank
const BORDER = rgb(0.8, 0.8, 0.8);

interface HistoryRow {
  actorName: string;   // vd: Trần Thị Thanh Tuyền
  code?: string;       // vd: HD000676 (mã NV / username)
  orgUnit?: string;    // vd: PM&PR
  email: string;
  action: ApprovalAction | string;
  step: number;
  comment?: string;
  at: Date;
}

// Bố cục cột bảng (tổng ~ 495pt trong khổ A4 lề 50)
const COLS = [
  { key: '#', title: '#', w: 30 },
  { key: 'user', title: 'Người dùng', w: 150 },
  { key: 'step', title: 'Bước', w: 70 },
  { key: 'date', title: 'Ngày', w: 85 },
  { key: 'comment', title: 'Bình luận', w: 160 },
];

@Injectable()
export class ApprovalPdfService {
  private fontReg?: Uint8Array;
  private fontBold?: Uint8Array;

  private loadFonts() {
    if (this.fontReg && this.fontBold) return;
    const dir = path.join(process.cwd(), 'assets', 'fonts');
    this.fontReg = fs.readFileSync(path.join(dir, 'arial.ttf'));
    this.fontBold = fs.readFileSync(path.join(dir, 'arialbd.ttf'));
  }

  /**
   * Nối 1 trang Lịch sử phê duyệt (định dạng bảng, tiếng Việt có dấu) vào cuối PDF gốc.
   * Nếu không có basePdf → tạo PDF mới chỉ gồm trang lịch sử.
   */
  async build(doc: Document, history: HistoryRow[], basePdf?: Buffer): Promise<Buffer> {
    this.loadFonts();

    let pdf: PDFDocument;
    try {
      pdf = basePdf ? await PDFDocument.load(basePdf) : await PDFDocument.create();
    } catch {
      pdf = await PDFDocument.create();
    }
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(this.fontReg!, { subset: true });
    const bold = await pdf.embedFont(this.fontBold!, { subset: true });

    // Đóng dấu MÃ HỒ SƠ + NGÀY HOÀN THÀNH lên góc trên-phải MỖI TRANG GỐC (trước khi thêm trang lịch sử)
    if (doc.code) {
      const line1 = `Mã hồ sơ: ${doc.code}`;
      const line2 = doc.completedAt ? `Hoàn thành: ${this.fmt(doc.completedAt)}` : '';
      const sSize = 9;
      for (const pg of pdf.getPages()) {
        const sz = pg.getSize();
        const w1 = bold.widthOfTextAtSize(line1, sSize);
        pg.drawText(line1, { x: sz.width - w1 - 20, y: sz.height - 22, size: sSize, font: bold, color: RED });
        if (line2) {
          const w2 = font.widthOfTextAtSize(line2, 8);
          pg.drawText(line2, { x: sz.width - w2 - 20, y: sz.height - 34, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
        }
      }
    }

    const A4: [number, number] = [595, 842];
    const margin = 50;
    let page = pdf.addPage(A4);
    let y = A4[1] - 50;

    const newPage = () => { page = pdf.addPage(A4); y = A4[1] - 50; };

    // Tiêu đề đỏ căn giữa
    const title = 'LỊCH SỬ PHÊ DUYỆT';
    const tSize = 18;
    const tWidth = bold.widthOfTextAtSize(title, tSize);
    page.drawText(title, { x: (A4[0] - tWidth) / 2, y, size: tSize, font: bold, color: RED });
    y -= 34;

    // Dòng mã + tiêu đề hồ sơ (bọc dòng)
    const headerText = `${doc.code ? doc.code + ' - ' : ''}${doc.title}`;
    y = this.drawWrapped(page, headerText, margin, y, A4[0] - margin * 2, font, 11, rgb(0.1, 0.1, 0.1), 15, newPage, () => page, () => y, (ny) => { y = ny; });
    y -= 16;

    // ===== Bảng =====
    const tableX = margin;
    const lineH = 14;
    const padX = 5;
    const padY = 5;

    const drawHeaderRow = () => {
      const h = 24;
      let x = tableX;
      page.drawRectangle({ x: tableX, y: y - h, width: COLS.reduce((s, c) => s + c.w, 0), height: h, color: RED });
      for (const c of COLS) {
        const tw = bold.widthOfTextAtSize(c.title, 10);
        page.drawText(c.title, { x: x + (c.w - tw) / 2, y: y - h + 8, size: 10, font: bold, color: rgb(1, 1, 1) });
        x += c.w;
      }
      y -= h;
    };

    drawHeaderRow();

    history.forEach((h, i) => {
      const userText = [h.code, (h.actorName || '').toUpperCase()].filter(Boolean).join(' ') + (h.orgUnit ? ` - ${h.orgUnit}` : '');
      const cells: Record<string, string> = {
        '#': String(i + 1),
        user: userText,
        step: ACTION_LABEL[h.action] || String(h.action),
        date: this.fmt(h.at),
        comment: h.comment || '',
      };

      // Tính số dòng wrap cho mỗi cột để xác định chiều cao hàng
      const wrapped: Record<string, string[]> = {};
      let maxLines = 1;
      for (const c of COLS) {
        const lines = this.wrapText(cells[c.key], c.w - padX * 2, font, 9);
        wrapped[c.key] = lines;
        maxLines = Math.max(maxLines, lines.length);
      }
      const rowH = maxLines * lineH + padY * 2;

      if (y - rowH < 50) { newPage(); drawHeaderRow(); }

      // Vẽ ô + viền + chữ
      let x = tableX;
      for (const c of COLS) {
        page.drawRectangle({ x, y: y - rowH, width: c.w, height: rowH, borderColor: BORDER, borderWidth: 0.5 });
        const lines = wrapped[c.key];
        lines.forEach((ln, li) => {
          const centered = c.key === '#' || c.key === 'step';
          const tw = font.widthOfTextAtSize(ln, 9);
          const tx = centered ? x + (c.w - tw) / 2 : x + padX;
          page.drawText(ln, { x: tx, y: y - padY - (li + 1) * lineH + 4, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
        });
        x += c.w;
      }
      y -= rowH;
    });

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  // Bọc dòng theo bề rộng
  private wrapText(text: string, maxW: number, font: PDFFont, size: number): string[] {
    if (!text) return [''];
    text = text.normalize('NFC'); // chuẩn hóa dấu tiếng Việt liền (Arial có glyph NFC)
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  // Vẽ đoạn text dài có bọc dòng (cho dòng tiêu đề hồ sơ)
  private drawWrapped(
    page: PDFPage, text: string, x: number, startY: number, maxW: number,
    font: PDFFont, size: number, color: any, lineH: number,
    _newPage: () => void, _getPage: () => PDFPage, _getY: () => number, _setY: (n: number) => void,
  ): number {
    const lines = this.wrapText(text, maxW, font, size);
    let yy = startY;
    for (const ln of lines) {
      page.drawText(ln, { x, y: yy, size, font, color });
      yy -= lineH;
    }
    return yy;
  }

  private fmt(d: Date): string {
    // Backend chạy UTC → cộng 7 giờ ra giờ Việt Nam (GMT+7), dùng getUTC* để chắc chắn đúng
    const x = new Date(new Date(d).getTime() + 7 * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(x.getUTCDate())}-${p(x.getUTCMonth() + 1)}-${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())}`;
  }
}
