{ComponentRegistry} = require 'nylas-exports'
{activate, deactivate} = require '../lib/main'

MessageLoader = require '../lib/message-loader'

describe "activate", ->
  it "should register the composer button and sidebar", ->
    spyOn(ComponentRegistry, 'register')
    activate()
    expect(ComponentRegistry.register).toHaveBeenCalledWith(MessageLoader, {role: 'message:BodyHeader'})

describe "deactivate", ->
  it "should unregister the composer button and sidebar", ->
    spyOn(ComponentRegistry, 'unregister')
    deactivate()
    expect(ComponentRegistry.unregister).toHaveBeenCalledWith(MessageLoader)
