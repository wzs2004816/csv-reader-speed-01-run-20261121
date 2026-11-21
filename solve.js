// Fast CSV reader: returns exactly csv-reader 1.0.0's answer for {text, header}.
// Written from the competition spec in RULES.txt.
//
// The text is read once, left to right. A U+FEFF at its very start is dropped.
// A record ends at LF or CRLF, and a line left with no characters is no record.
// Outside quotes a CR not followed by LF is dropped (error stray_cr). A field
// that opens with a quote runs to the next quote that is not doubled, "" inside
// it one quote and each CRLF or lone CR inside it read as LF; what follows its
// closing quote, up to the next comma or line break, is appended as it stands
// (quote_junk, when the field ends); a quote that never closes is a literal
// character, and the text after it is read again as unquoted
// (unterminated_quote). A quote inside an unquoted field is a literal character.
// Fields stay strings, never trimmed or converted. columns is the first record
// when header is true, else null; rows holds the records after it, each padded
// with empty strings (short_row, with fields: its field count) or cut (long_row,
// with extra: the cut fields) to the first record's width. Each error is
// {code, line, row}, in the order met; line is the 1-based line its record
// starts on, counting every LF, CRLF and lone CR inside quotes, and row is its
// record's index in rows, null for the header.
//
// Speed: no per-character loop over the common path. Unquoted fields are found
// with indexOf jumps; the next LF of the current physical line and whether
// that line holds a stray CR are cached, so a plain field costs one indexOf
// (for the next comma) and one slice. Quoted fields scan for the closing quote
// the same way. Field values are slices of the input wherever possible, so the
// common case allocates one string per field and nothing else.

export function run(input) {
  const text = input.text;
  const header = input.header === true;
  const n = text.length;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) i = 1;

  const errors = [];
  const rows = [];
  let columns = null;
  let width = 0;
  let first = true;
  let line = 1; // 1-based line number at position i
  let rowIdx = 0; // index of the next data row in rows

  // Cached end of the current physical line: nl is the next LF at or after
  // the position the cache was taken from, or n when there is none; lineStray
  // says whether a CR that is not the CRLF ending this line occurs at or after
  // that position and before nl. Both go stale once the parser moves past nl
  // (a record ending, or a quoted field with a line break inside it) and are
  // refreshed from the new position on next use.
  let nl = -1;
  let lineStray = false;

  while (i < n) {
    // A line left with no characters is no record.
    const ch = text.charCodeAt(i);
    if (ch === 10) { line++; i++; continue; }
    if (ch === 13 && i + 1 < n && text.charCodeAt(i + 1) === 10) { line++; i += 2; continue; }

    const recLine = line;
    const recRow = first && header ? null : rowIdx;
    const fields = [];
    let done = false;

    while (!done) {
      let value;
      let after; // 0 comma, 1 LF, 2 CRLF, 3 end of text
      let quoted = i < n && text.charCodeAt(i) === 34;
      if (quoted) {
        // ----- quoted field -----
        let p = i + 1;
        let close = -1;
        let esc = null; // positions of "" escape quotes
        for (;;) {
          const k = text.indexOf('"', p);
          if (k === -1) break;
          if (k + 1 < n && text.charCodeAt(k + 1) === 34) {
            if (esc === null) esc = [];
            esc.push(k);
            p = k + 2;
            continue;
          }
          close = k;
          break;
        }
        if (close === -1) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as unquoted.
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          quoted = false;
        } else {
          // Assemble the value from the quoted span, resolving "" to ".
          if (esc === null) {
            value = text.slice(i + 1, close);
          } else {
            let s = text.slice(i + 1, esc[0]);
            for (let e = 0; e < esc.length; e++) {
              const next = e + 1 < esc.length ? esc[e + 1] : close;
              s += '"' + text.slice(esc[e] + 2, next);
            }
            value = s;
          }
          // Lines inside the quotes count: every LF, every CRLF, every lone
          // CR. CRLF and lone CR inside are read as LF in the value.
          let add = 0;
          let hasCR = false;
          let q = i + 1;
          for (;;) {
            const k = text.indexOf('\n', q);
            if (k === -1 || k >= close) break;
            add++;
            q = k + 1;
          }
          q = i + 1;
          for (;;) {
            const k = text.indexOf('\r', q);
            if (k === -1 || k >= close) break;
            hasCR = true;
            if (k + 1 >= close || text.charCodeAt(k + 1) !== 10) add++;
            q = k + 1;
          }
          line += add;
          if (hasCR) value = value.replace(/\r\n?/g, '\n');
          // What follows the closing quote, up to the next comma or line
          // break, is appended as it stands (quote_junk, when the field ends).
          // Fast path: the next character is the delimiter itself, so there
          // is no junk to scan for.
          const nc = close + 1 < n ? text.charCodeAt(close + 1) : -1;
          if (nc === 44) { i = close + 2; after = 0; }
          else if (nc === 10) { i = close + 1; after = 1; }
          else if (nc === 13 && close + 2 < n && text.charCodeAt(close + 2) === 10) { i = close + 2; after = 1; }
          else if (nc === -1) { i = n; after = 3; }
          else {
          let junk = null;
          let p2 = close + 1;
          for (;;) {
            if (p2 > nl) {
              nl = text.indexOf('\n', p2);
              if (nl === -1) nl = n;
              const cr0 = text.indexOf('\r', p2);
              lineStray = cr0 !== -1 && cr0 < nl && !(cr0 + 1 === nl && nl < n);
            }
            const cI = text.indexOf(',', p2);
            let end = nl;
            let kind = nl < n ? 1 : 3;
            if (cI !== -1 && cI < nl) { end = cI; kind = 0; }
            if (lineStray) {
              const rI = text.indexOf('\r', p2);
              if (rI !== -1 && rI < end && !(nl < n && rI === nl - 1)) {
                if (rI > p2) junk = junk === null ? text.slice(p2, rI) : junk + text.slice(p2, rI);
                errors.push({ code: 'stray_cr', line: recLine, row: recRow });
                p2 = rI + 1;
                continue;
              }
            }
            let e = end;
            if (kind === 1 && e > p2 && text.charCodeAt(e - 1) === 13) e--;
            if (e > p2) junk = junk === null ? text.slice(p2, e) : junk + text.slice(p2, e);
            if (junk !== null) {
              value += junk;
              errors.push({ code: 'quote_junk', line: recLine, row: recRow });
            }
            if (kind === 0) { i = end + 1; after = 0; }
            else if (kind === 1) { i = end; after = 1; }
            else { i = n; after = 3; }
            break;
          }
          }
        }
      }
      if (!quoted) {
        // ----- unquoted field (inlined hot path) -----
        // A quote here is a literal character. The field runs to the next
        // comma or line break; a CR not followed by LF is dropped (stray_cr)
        // and the field continues after it.
        let parts = null;
        let p = i;
        for (;;) {
          if (p > nl) {
            nl = text.indexOf('\n', p);
            if (nl === -1) nl = n;
            const cr0 = text.indexOf('\r', p);
            lineStray = cr0 !== -1 && cr0 < nl && !(cr0 + 1 === nl && nl < n);
          }
          const cI = text.indexOf(',', p);
          let end = nl;
          let kind = nl < n ? 1 : 3;
          if (cI !== -1 && cI < nl) { end = cI; kind = 0; }
          if (lineStray) {
            const rI = text.indexOf('\r', p);
            if (rI !== -1 && rI < end && !(nl < n && rI === nl - 1)) {
              if (rI > p) parts = parts === null ? text.slice(p, rI) : parts + text.slice(p, rI);
              errors.push({ code: 'stray_cr', line: recLine, row: recRow });
              p = rI + 1;
              continue;
            }
          }
          let e = end;
          if (kind === 1 && e > p && text.charCodeAt(e - 1) === 13) e--;
          const tail = e > p ? text.slice(p, e) : '';
          value = parts === null ? tail : parts + tail;
          if (kind === 0) { i = end + 1; after = 0; }
          else if (kind === 1) { i = end; after = 1; }
          else { i = n; after = 3; }
          break;
        }
      }
      fields.push(value);
      if (after === 0) continue; // comma: next field
      if (after === 1) { line++; i++; } // LF
      else if (after === 2) { line++; i += 2; } // CRLF (unreachable: CRLF ends as kind 1)
      done = true; // LF or end of text: the record ends
    }

    if (first) {
      width = fields.length;
      if (header) columns = fields;
      else { rows.push(fields); rowIdx++; }
      first = false;
    } else {
      if (fields.length < width) {
        errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
        while (fields.length < width) fields.push('');
      } else if (fields.length > width) {
        errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.slice(width) });
        fields.length = width;
      }
      rows.push(fields);
      rowIdx++;
    }
  }

  return { columns, rows, errors };
}
