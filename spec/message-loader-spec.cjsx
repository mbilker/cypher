{Contact, Message, React} = require 'nylas-exports'
ReactTestUtils = React.addons.TestUtils

MessageLoader = require '../lib/message-loader'

me = new Contact
  name: TEST_ACCOUNT_NAME
  email: TEST_ACCOUNT_EMAIL

describe "MessageLoader", ->
  beforeEach ->
    @message = new Message
      from: [me]
      to: [me]
      cc: []
      bcc: []
    @component = ReactTestUtils.renderIntoDocument(
      <MessageLoader message={@message} />
    )

  it "should render into the page", ->
    expect(@component).toBeDefined()

  it "should have a displayName", ->
    expect(MessageLoader.displayName).toBe('MessageLoader')

  it "multipart parser should throw when text input is null", ->
    text = null
    expect(-> @component._extractHTML(text)).toThrow()

  #it "should show a dialog box when clicked", ->
    #spyOn(@component, '_onClick')
    #buttonNode = React.findDOMNode(@component.refs.button)
    #ReactTestUtils.Simulate.click(buttonNode)
    #expect(@component._onClick).toHaveBeenCalled()
