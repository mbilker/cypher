// A file that specifies protocol types between the master and worker processes

exports.SECRET_KEY              = 1;
exports.PASSPHRASE              = 2;
exports.ENCRYPTED_MESSAGE       = 3;
exports.DECRYPT                 = 4;
exports.PROMISE_RESOLVE         = 5;
exports.PROMISE_REJECT          = 6;
exports.REQUEST_PASSPHRASE      = 7;
exports.VERBOSE_OUT             = 8;
exports.ERROR_OCCURRED          = 9;
