# Error class to not print a stack trace
# Useful for stopping a Promise chain
class FlowError extends Error
  name: 'FlowError'
  constructor: (@message, @display = false) ->
    super
    Error.captureStackTrace @, arguments.callee
    @title = @message

module.exports = FlowError
