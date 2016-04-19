// A file that specifies protocol types between the master and worker processes

module.exports = {
  DECRYPT: 1,
  PROMISE_RESOLVE: 2,
  PROMISE_REJECT: 3,
  PROMISE_NOTIFY: 4,
  REQUEST_PASSPHRASE: 5,
  VERBOSE_OUT: 6,
  ERROR_OCCURRED: 7,
  LIST_PENDING_PROMISES: 8,
  GET_KEYS: 9,
};
