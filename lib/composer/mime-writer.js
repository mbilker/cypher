/** @babel */

import mimelib from 'mimelib';
import uuid from 'uuid';

const CR = '\r';
const LF = '\n';
const CRLF = CR + LF;

// MIME Writer to create the MIME encoded emails before encryption. Normally
// the N1 Sync Engine does this itself, but for the case of secrecy of emails
// from the Sync Engine the emails are encoded in the N1 clients
//
// Based on https://github.com/isaacs/multipart-js
export default class MIMEWriter {
  constructor(boundary = `PGP-N1=_${uuid().toUpperCase()}`) {
    this._boundary = boundary;
    this._output = '';

    this.writePart = this.writePart.bind(this);
    this.end = this.end.bind(this);
    this._writeHeader = this._writeHeader.bind(this);

    this._writeHeader();
  }

  writePart(message, {
    encoding = '7bit',
    type = `text/plain; charset="UTF-8"`,
    name,
    filename,
  } = {}) {
    let opener = `--${this._boundary}${CRLF}`;
    opener += `Content-Type: ${type}`;

    if (name) opener += `; name="${name}"`;
    if (filename) opener += `; filename="${filename}"`;

    opener = mimelib.foldLine(opener);
    opener += CRLF;

    this._output += opener;
    this._output += mimelib.foldLine(`Content-Transfer-Encoding: ${encoding}`);
    this._output += CRLF;
    this._output += CRLF;
    this._output += message + CRLF;

    return this;
  }

  end() {
    this._output = `${this._output}${CRLF}--${this._boundary}--${CRLF}`;

    return this._output;
  }

  _writeHeader() {
    let header = `Content-Type: multipart/signed; ${CRLF}`;
    header += `\tboundary="${this._boundary}";${CRLF}`;
    header += `\tprotocol="application/pgp-signature"${CRLF}`;
    header += CRLF + CRLF;

    this._output = header;
  }
}
