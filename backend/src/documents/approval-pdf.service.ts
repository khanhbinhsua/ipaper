import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document } from './document.entity';
import { Approval, ApprovalAction } from './approval.entity';

const ACTION_LABEL: Record<string, string> = {
  submit: 'Gui duyet',
  approve: 'Da duyet',
  reject: 'Tu choi',
  return: 'Tra ve',
  save_draft: 'Luu nhap',
  forward: 'Gui duyet tiep',
  complete: 'Hoan thanh',
};

interface HistoryRow {
  actorName: string;
  email: string;
  action: ApprovalAction | string;
  step: number;
  comment?: string;
  at: Date;
}

@Injectable()
export class ApprovalPdfService {
  /**
   * Tạo (hoặc nối thêm vào) PDF lịch sử phê duyệt.
   * - basePdf: buffer PDF tài liệu phê duyệt gốc (nếu có) để nối lịch sử vào cuối.
   * - Nếu không có/không phải PDF hợp lệ → tạo PDF mới.
   * Lưu ý: dùng font chuẩn (WinAnsi) nên text bỏ dấu tiếng Việt để tránh lỗi glyph.
   */
  async build(doc: Document, history: HistoryRow[], basePdf?: Buffer): Promise<Buffer> {
    let pdf: PDFDocument;
    try {
      pdf = basePdf ? await PDFDocument.load(basePdf) : await PDFDocument.create();
    } catch {
      pdf = await PDFDocument.create();
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    const left = 50;

    const line = (text: string, opts: { size?: number; bold?: boolean; color?: any } = {}) => {
      const size = opts.size ?? 11;
      if (y < 60) { page = pdf.addPage([595, 842]); y = height - 50; }
      page.drawText(text, { x: left, y, size, font: opts.bold ? fontBold : font, color: opts.color ?? rgb(0.1, 0.1, 0.1) });
      y -= size + 8;
    };

    // Tiêu đề
    page.drawRectangle({ x: 0, y: height - 30, width, height: 30, color: rgb(0.894, 0, 0.169) });
    page.drawText('LICH SU PHE DUYET HO SO', { x: left, y: height - 22, size: 14, font: fontBold, color: rgb(1, 1, 1) });
    y = height - 60;

    line(`Tieu de: ${strip(doc.title)}`, { bold: true, size: 12 });
    line(`Loai yeu cau: ${strip(doc.docType || '-')}`);
    line(`Bo phan: ${strip(doc.orgUnit || '-')}`);
    line(`Trang thai: HOAN THANH`);
    line(`Ngay xuat: ${fmt(new Date())}`);
    y -= 8;
    line('CAC BUOC PHE DUYET:', { bold: true, size: 12, color: rgb(0.894, 0, 0.169) });
    y -= 4;

    history.forEach((h, i) => {
      line(`${i + 1}. [${ACTION_LABEL[h.action] || h.action}] ${strip(h.actorName)} (${h.email}) - Buoc ${h.step}`, { bold: true });
      line(`   Thoi gian: ${fmt(h.at)}`);
      if (h.comment) line(`   Y kien: ${strip(h.comment)}`);
      y -= 4;
    });

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }
}

// Bỏ dấu tiếng Việt để in bằng font chuẩn
function strip(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function fmt(d: Date): string {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}
