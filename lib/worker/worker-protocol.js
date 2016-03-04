// A file that specifies protocol types between the master and worker processes

module.exports = {
  DECRYPTION_RESULT: 1,
  DECRYPT: 2,
  PROMISE_RESOLVE: 3,
  PROMISE_REJECT: 4,
  PROMISE_NOTIFY: 5,
  REQUEST_PASSPHRASE: 6,
  VERBOSE_OUT: 7,
  ERROR_OCCURRED: 8,
  LIST_PENDING_PROMISES: 9,
};
