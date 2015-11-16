# # PGP Message Loader
#
# Currently for Facebook PGP-encrypted email, this will detect that Facebook
# puts the PGP encrypted document as the second attachment. It will read the
# attachment from disk asynchrnously with background tasks

fs = require 'fs'
{Utils, FileDownloadStore, MessageBodyProcessor, React} = require 'nylas-exports'

InProcessDecrypter = require './in-process-decrypter'
WorkerProcessDecrypter = require './worker-process-decrypter'
FlowError = require './flow-error'

class MessageLoader extends React.Component
  @displayName: 'MessageLoader'

  @propTypes:
    message: React.PropTypes.object.isRequired

  constructor: (@props) ->
    @state =
      _decryptable: false
      _lastError: 0
      # Holds the downloadData (if any) for all of our files. It's a hash
      # keyed by a fileId. The value is the downloadData.
      downloads: FileDownloadStore.downloadDataForFiles(@props.message.fileIds())

  # taken from
  # https://github.com/nylas/N1/blob/master/internal_packages/message-list/lib/email-frame.cjsx
  componentDidMount: =>
    @_storeUnlisten = FileDownloadStore.listen(@_onDownloadStoreChange)
    @_decryptMail()

  componentDidUpdate: =>
    @_decryptMail()

  shouldComponentUpdate: (nextProps, nextState) =>
    not Utils.isEqualReact(nextProps, @props) or
    not Utils.isEqualReact(nextState, @state)

  render: =>
    decryptable = @state?._decryptable or @props.message.files.length > 0
    displayError = @state?._lastError and @state?._lastError.display

    if decryptable and not @props.message.body
      @_renderDecryptingMessage()
    else if displayError
      @_renderErrorMessage()
    else
      <span />

  _renderIFrame: =>
    <EventedIFrame ref="iframe" seamless="seamless" onResize={@_setFrameHeight}/>

  _renderDecryptingMessage: =>
    <div className="statusBox indicatorBox">
      <p>Decrypting message</p>
    </div>

  _renderErrorMessage: =>
    <div className="statusBox errorBox">
      <p><b>Error:</b> {@state._lastError.message}</p>
    </div>

  _onDownloadStoreChange: =>
    @setState
      downloads: FileDownloadStore.downloadDataForFiles(@props.message.fileIds())

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
          throw new Error("Attachment file not readable", true)
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

  _extractHTML: (text) ->
    start = process.hrtime()
    matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
    end = process.hrtime(start)
    if matches
      console.log "%cHTML found in decrypted: #{end[0] * 1e3 + end[1] / 1e6}ms", "color:blue"
      matches[1]
    else
      throw new FlowError("no HTML found in decrypted")

  # The main brains of this project. This retrieves the attachment and secret
  # key (someone help me find a (secure) way to store the secret key) in
  # parallel. We parse the HTML out of the content, then update the state which
  # triggers a page update
  _decryptMail: =>
    {message} = @props
    window.loader = @

    console.group "[PGP] Message: #{message.id}"

    decrypter = @_selectDecrypter()
    startDecrypt = process.hrtime()
    @_getAttachmentAndKey().spread(decrypter).then((text) ->
      endDecrypt = process.hrtime(startDecrypt)
      console.log "%cTotal message decrypt time: #{endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms", "color:blue"
      text
    ).then(@_extractHTML).then((match) =>
      message.body = match
      MessageBodyProcessor.resetCache()
      @forceUpdate()
    ).catch((error) =>
      if error instanceof FlowError
        console.log error.title
      else
        console.log error.stack
      @setState
        _decryptable: false
        _lastError: error
    ).finally ->
      console.groupEnd()

module.exports = MessageLoader
