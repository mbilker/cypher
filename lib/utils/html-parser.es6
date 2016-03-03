import MimeParser from 'mimeparser';

import Logger from './Logger';

const log = Logger.create(`MimeParser`);

// Uses regex to extract HTML component from a multipart message. Does not
// contribute a significant amount of time to the decryption process.
export function extractHTML({text}) {
  return new Promise((resolve, reject) => {
    let parser = new MimeParser();

    // Use MIME parsing to extract possible body
    var matched, lastContentType;
    let start = process.hrtime();

    parser.onbody = (node, chunk) => {
      if ((node.contentType.value === 'text/html') || // HTML body
          (node.contentType.value === 'text/plain' && !matched)) { // Plain text
        matched = new Buffer(chunk).toString('utf8');
        lastContentType = node.contentType.value;
      }
    };
    parser.onend = () => {
      let end = process.hrtime(start);
      log.info(`Parsed MIME in ${end[0] * 1e3 + end[1] / 1e6}ms`);
    };

    parser.write(text);
    parser.end();

    // Fallback to regular expressions method
    if (!matched) {
      start = process.hrtime();
      let matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
      let end = process.hrtime(start);
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
      let formatted = `<html><head></head><body><b>FALLBACK TO RAW:</b><br>${text}</body></html>`;
      resolve(formatted);
      //reject(new FlowError("no HTML found in decrypted"));
    }
  });
}
