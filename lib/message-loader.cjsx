# # PGP Message Loader
#
# Currently for Facebook PGP-encrypted email, this will detect that Facebook
# puts the PGP encrypted document as the second attachment. It will read the
# attachment from disk asynchrnously with background tasks

fs = require 'fs'
openpgp = require 'openpgp'
{Utils, FileDownloadStore, React} = require 'nylas-exports'
{EventedIFrame} = require 'nylas-component-kit'

InProcessDecrypter = require './in-process-decrypter'
WorkerProcessDecrypter = require './worker-process-decrypter'
FlowError = require './flow-error'

#MessageLoader = React.createClass
#  displayName: 'MessageLoader'

class MessageLoader extends React.Component
  @displayName: 'MessageLoader'

  @propTypes:
    message: React.PropTypes.object.isRequired

  @state:
    _notDecryptable: false
    _lastError: 0

  constructor: ->
    @_lastComputedHeight = 0
    #throw new Error("bleh")

  render: =>
    notDecryptable = @state?._notDecryptable or @props.message.files.length is 0

    if @_decryptedHTML
      <EventedIFrame ref="iframe" seamless="seamless" onResize={@_setFrameHeight}/>
    else if not notDecryptable
      <div className="indicatorBox">
        <p>Decrypting message</p>
      </div>
    else if @state?._lastError and @state?._lastError.display
      <div className="errorBox">
        <p><b>Error:</b> {@state._lastError.message}</p>
      </div>
    else
      <span />

  # taken from
  # https://github.com/nylas/N1/blob/master/internal_packages/message-list/lib/email-frame.cjsx
  componentDidMount: =>
    @_mounted = true
    #@_writeContent()
    #@_setFrameHeight()
    setImmediate =>
      @_decryptMail()

  componentWillUnmount: =>
    @_mounted = false

  componentDidUpdate: =>
    @_writeContent()
    @_setFrameHeight()

  _writeContent: =>
    return unless @_decryptedHTML

    doc = React.findDOMNode(@).contentDocument
    doc.open()

    # NOTE: The iframe must have a modern DOCTYPE. The lack of this line
    # will cause some bizzare non-standards compliant rendering with the
    # message bodies. This is particularly felt with <table> elements use
    # the `border-collapse: collapse` css property while setting a
    # `padding`.
    doc.write("<!DOCTYPE html>")

    EmailFixingStyles = document.querySelector('[source-path*="email-frame.less"]')?.innerText
    EmailFixingStyles = EmailFixingStyles.replace(/.ignore-in-parent-frame/g, '')
    if (EmailFixingStyles)
      doc.write("<style>#{EmailFixingStyles}</style>")
    doc.write("<div id='inbox-html-wrapper'>#{@_decryptedHTML}</div>")
    doc.close()

    # Notify the EventedIFrame that we've replaced it's document (with `open`)
    # so it can attach event listeners again.
    @refs.iframe.documentWasReplaced()

  _setFrameHeight: =>
    return unless @_mounted and @_decryptedHTML

    domNode = React.findDOMNode(@)
    wrapper = domNode.contentDocument.getElementsByTagName('html')[0]
    height = wrapper.scrollHeight

    # Why 5px? Some emails have elements with a height of 100%, and then put
    # tracking pixels beneath that. In these scenarios, the scrollHeight of the
    # message is always <100% + 1px>, which leads us to resize them constantly.
    # This is a hack, but I'm not sure of a better solution.
    if Math.abs(height - @_lastComputedHeight) > 5
      domNode.height = "#{height}px"
      @_lastComputedHeight = height

    unless domNode?.contentDocument?.readyState is 'complete'
      setImmediate => @_setFrameHeight()

  _getKey: ->
    fs.readFileAsync(require('path').join(process.env.HOME, 'pgpkey'), 'utf8')

  _retrievePGPAttachment: =>
    {message} = @props
    console.log "Attachments: %d", message.files.length
    if message.files.length >= 1
      path = FileDownloadStore.pathForFile message.files[1]

      # async fs.exists was throwing because the first argument was true,
      # found fs.access as a suitable replacement
      fs.accessAsync(path, fs.F_OK | fs.R_OK).then (err) ->
        if not err
          fs.readFileAsync(path, 'utf8').then (text) ->
            console.log "Read attachment from disk"
            text
        else
          throw new Error("Attachment file not readable")
    else
      throw new FlowError("No attachments")

  # Retrieves the attachment and encrypted secret key for code divergence later
  _getAttachmentAndKey: =>
    new Promise((resolve) =>
      resolve [@_retrievePGPAttachment(), @_getKey()]
    ).spread((text, pgpkey) =>
      throw new Error("No text in attachment") if not text
      throw new Error("No key in pgpkey variable") if not pgpkey
      [text, pgpkey]
    )

  _selectDecrypter: =>
    chosen = "WORKER_PROCESS"

    if chosen is "WORKER_PROCESS"
      new WorkerProcessDecrypter().decrypt
    else # IN_PROCESS
      new InProcessDecrypter().decrypt

  # The main brains of this project. This retrieves the attachment and secret
  # key (someone help me find a (secure) way to store the secret key) in
  # parallel. We parse the HTML out of the content, then update the state which
  # triggers a page update
  _decryptMail: =>
    window.loader = @
    console.group "[PGP] Message: #{@props.message.id}"
    decrypter = @_selectDecrypter()
    startDecrypt = process.hrtime()
    #console.time "Decrypted message"
    @_getAttachmentAndKey().spread(decrypter).then((text) ->
      endDecrypt = process.hrtime(startDecrypt)
      console.log "%cTotal message decrypt time: #{endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms", "color:blue"
      #console.timeEnd "Decrypted message"

      start = process.hrtime()
      matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
      end = process.hrtime(start)
      if matches
        console.log "%cHTML found in decrypted: #{end[0] * 1e3 + end[1] / 1e6}ms", "color:blue"
        matches[1]
      else
        throw new FlowError("no HTML found in decrypted")
    ).then((match) =>
      @_decryptedHTML = match
      @forceUpdate()
      setImmediate =>
        @_writeContent()
        @_setFrameHeight()
    ).catch((error) =>
      @_notDecryptable = true
      @_lastError = error
      if error instanceof FlowError
        console.log error.title
      else
        console.log error.stack
      @setState
        _notDecryptable: true
        _lastError: error
    ).finally ->
      console.groupEnd()

module.exports = MessageLoader
