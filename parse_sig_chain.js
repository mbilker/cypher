"use strict";

let fs = require('fs');

let parse = () => {
  return JSON.parse(fs.readFileSync('./json', 'utf8'))
    .sigs
    .map((x) => JSON.parse(x.payload_json))
    .filter((x) => x.body.type === 'sibkey')
    .map((x) => x.body)
}

console.log(parse());
