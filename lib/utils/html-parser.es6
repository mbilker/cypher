import MimeParser from 'emailjs-mime-parser';

import Logger from './Logger';

const regex = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim;
const log = Logger.create(`MimeParser`);

// Uses regex to extract HTML component from a multipart message. Does not
// contribute a significant amount of time to the decryption process.
export function extractHTML({ text }) {
  return new Promise((resolve) => {
    const parser = new MimeParser();

    // Use MIME parsing to extract possible body
    let matched = null;
    let start = process.hrtime();

    parser.onbody = (node, chunk) => {
      if ((node.contentType.value === 'text/html') || // HTML body
          (node.contentType.value === 'text/plain' && !matched)) { // Plain text
        matched = new Buffer(chunk).toString('utf8');
      }
    };
    parser.onend = () => {
      const end = process.hrtime(start);
      log.info(`Parsed MIME in ${end[0] * 1e3 + end[1] / 1e6}ms`);
    };

    parser.write(text);
    parser.end();

    // Fallback to regular expressions method
    if (!matched) {
      start = process.hrtime();
      const matches = regex.exec(text);
      const end = process.hrtime(start);
      if (matches) {
        log.info(`Regex found HTML in ${end[0] * 1e3 + end[1] / 1e6}ms`);
        matched = matches[1];
      }
    }

    if (matched) {
      resolve(matched);
    } else {
      // REALLY FALLBACK TO RAW
      log.error('FALLBACK TO RAW DECRYPTED');
      const formatted = `<html><head></head><body><b>FALLBACK TO RAW:</b><br>${text}</body></html>`;
      resolve(formatted);
    }
  });
}
