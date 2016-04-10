/** @babel */

import { Contact, File, Message, React, ReactDOM, ReactTestUtils } from 'nylas-exports';

import PGPStore from '../lib/flux/stores/pgp-store';
import MessageLoaderHeader from '../lib/message-loader/message-loader-header';

const me = new Contact({
  name: TEST_ACCOUNT_NAME,
  email: TEST_ACCOUNT_EMAIL
});

describe("MessageLoaderHeader", function() {
  beforeEach(function() {
    this.message = new Message({
      from: [me],
      to: [me],
      cc: [],
      bcc: []
    });
    this.component = ReactTestUtils.renderIntoDocument(
      <MessageLoaderHeader message={this.message} />
    );
  });

  it("should render into the page", function() {
    expect(this.component).toBeDefined();
  });

  it("should have a displayName", function() {
    expect(MessageLoaderHeader.displayName).toBe('MessageLoader');
  });

  describe("when not decrypting", function() {
    beforeEach(function() {
      this.component.setState({decrypting: false});
    });

    it("should have no child elements", function() {
      expect(ReactDOM.findDOMNode(this.component).childElementCount).toEqual(0);
    });
  });

  describe("when decrypting", function() {
    beforeEach(function() {
      this.component.setState({ decrypting: true });
    });

    it("should have one single child element", function() {
      expect(ReactDOM.findDOMNode(this.component).childElementCount).toEqual(1);
    });
  });

  it("should throw when text input to multipart parser is null", function() {
    let text = null;
    expect(() => this.component._extractHTML(text)).toThrow();
  });

  //it "should show a dialog box when clicked", function() {
    //spyOn(@component, '_onClick');
    //buttonNode = React.findDOMNode(this.component.refs.button);
    //ReactTestUtils.Simulate.click(buttonNode);
    //expect(@component._onClick).toHaveBeenCalled();
  //});
});
