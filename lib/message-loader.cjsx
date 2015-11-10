# # PGP Message Loader
#
# Currently for Facebook PGP-encrypted email, this will detect that Facebook
# puts the PGP encrypted document as the second attachment. It will read the
# attachment from disk asynchrnously with background tasks

child_process = require 'child_process'
fs = require 'fs'
openpgp = require 'openpgp'
{Utils, FileDownloadStore, React} = require 'nylas-exports'
{EventedIFrame} = require 'nylas-component-kit'

#MessageLoader = React.createClass
#  displayName: 'MessageLoader'

class MessageLoader extends React.Component
  @displayName: 'MessageLoader'

  @propTypes:
    message: React.PropTypes.object.isRequired

  render: =>
    indicatorBox =
      display: 'block'
      boxSizing: 'border-box'
      WebkitPrintColorAdjust: 'exact'
      padding: '8px 12px'
      marginBottom: '5px'
      border: '1px solid rgb(235, 204, 209)'
      borderRadius: '4px'
      color: 'rgb(169, 68, 66)'
      backgroundColor: 'rgb(242, 222, 222)'

    notDecryptable = @_notDecryptable or @props.message.files.length is 0

    if @_decryptedHTML
      <EventedIFrame ref="iframe" seamless="seamless" onResize={@_setFrameHeight}/>
    else if not notDecryptable
      <div style={indicatorBox}>
        <p>Decrypting message</p>
      </div>
    else
      <span />

  # taken from
  # https://github.com/nylas/N1/blob/master/internal_packages/message-list/lib/email-frame.cjsx
  componentDidMount: =>
    @_lastComputedHeight ?= 0

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
    console.log "[PGP] Attachments: %d", message.files.length
    if message.files.length >= 1
      path = FileDownloadStore.pathForFile message.files[1]

      # async fs.exists was throwing because the first argument was true,
      # found fs.access as a suitable replacement
      fs.accessAsync(path, fs.F_OK | fs.R_OK).then (err) ->
        if not err
          fs.readFileAsync(path, 'utf8').then (text) ->
            console.log "[PGP] Read attachment from disk"
            text
        else
          throw new Error("[PGP] Attachment file not readable")
    else
      throw new Error("[PGP] No attachments")

  # Retrieves the attachment and encrypted secret key for code divergence later
  _getAttachmentAndKey: =>
    new Promise((resolve) =>
      resolve [@_retrievePGPAttachment(), @_getKey()]
    ).spread((text, pgpkey) =>
      throw new Error("[PGP] No text in attachment") if not text
      throw new Error("[PGP] No key in pgpkey variable") if not pgpkey
      [text, pgpkey]
    )

  _decryptInCurrentThread: =>
    @_getAttachmentAndKey().spread((text, pgpkey) =>
      key = openpgp.key.readArmored(pgpkey)
      if key.error
        throw key.error

      [text, key.keys[0]]
    ).spread((text, pgpkey) =>
      console.log "[PGP] Decrypting secret key"
      pgpkey.decrypt("") # TODO: switch to loading this from user interface
      console.log "[PGP] Decrypted secret key, decrypting message"
      [text, pgpkey]
    ).spread((text, pgpkey) =>
      openpgp.decryptMessage pgpkey, openpgp.message.readArmored(text)
    )

  _decryptInForkedWorker: =>
    child = null
    protocol =
      SECRET_KEY: 1
      PASSPHRASE: 2
      ENCRYPTED_MESSAGE: 3
      DECRYPT: 4
      SECRET_KEY_DECRYPT_TIME: 5
      MESSAGE_DECRYPT_TIME: 6
      DECRYPTED_TEXT: 7
      ERROR: 8

    @_getAttachmentAndKey().spread((text, pgpkey) =>
      child = child_process.fork require('path').join(__dirname, 'worker-decrypt.js')
      passphrase = ''

      promise = new Promise (resolve, reject) ->
        child.on 'message', (message) ->
          console.log message
          if message.method is protocol.DECRYPTED_TEXT
            resolve message.text
          else if message.method is protocol.ERROR
            reject message.error

      child.send
        method: protocol.SECRET_KEY
        secretKey: pgpkey.toString()
      child.send
        method: protocol.ENCRYPTED_MESSAGE
        encryptedMessage: text
      child.send
        method: protocol.PASSPHRASE
        passphrase: passphrase.toString()
      child.send
        method: protocol.DECRYPT

      promise
    )

  # The main brains of this project. This retrieves the attachment and secret
  # key (someone help me find a (secure) way to store the secret key) in
  # parallel. It spawns the worker, sends the 2 files via IPC. Worker sends
  # decrypted content back. We parse the HTML out of the content, then store the
  # value in *this* and force an update
  _decryptMail: =>
    window.loader = @

    @_decryptInForkedWorker().then((text) ->
      console.log "[PGP] Decrypted message"
      matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
      if matches
        console.log "[PGP] HTML found in decrypted"
        matches[1]
      else
        throw new Error("[PGP] no HTML found in decrypted")
    ).then((match) =>
      @_decryptedHTML = match
      @forceUpdate()
      setImmediate =>
        @_writeContent()
        @_setFrameHeight()
    ).catch (error) =>
      @_notDecryptable = true
      console.log error.stack

module.exports = MessageLoader
