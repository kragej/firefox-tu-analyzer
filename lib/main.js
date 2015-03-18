var Events = require("sdk/system/events");
var Request = require("sdk/request").Request;
var { Cc, Ci } = require("chrome");

function TracingListener() {
	this.originalListener = null;
    this.receivedBytes = [];
}

TracingListener.prototype = {
	
	onStartRequest: function(request, context) {
		this.originalListener.onStartRequest(request, context);
	},
	
	onDataAvailable: function(request, context, inputStream, offset, count) {
        var binaryInputStream= Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
        var storageStream = Cc["@mozilla.org/storagestream;1"].createInstance(Ci.nsIStorageStream);
        var binaryOutputStream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);

        binaryInputStream.setInputStream(inputStream);
        storageStream.init(8192, count, null);

        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        var data = binaryInputStream.readBytes(count);
        this.receivedBytes.push(data);

        binaryOutputStream.writeBytes(data, count);

		this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, count);
	},
	
	onStopRequest: function(request, context, statusCode) {
        this.originalListener.onStopRequest(request, context, statusCode);
        var responseSourceJSON = this.receivedBytes.join();
        var responseSource = JSON.parse(responseSourceJSON);

        if (responseSource && 'new_cards' in responseSource) {
            for (var i = 0; i < responseSource['new_cards'].length; i++) {
                var cardId = responseSource['new_cards'][i];
                var logRequest = Request({
                    url: "http://digitalpresence.dk/tyrant-test/index.php?card_id="+cardId
                });

                logRequest.get();
            }

        }
	}
}

/**
 * Listener which handles "http-on-examine-response" events
 * @param event
 */
function httpResponseExamineListener (event) {
	var newListener = new TracingListener();
	var httpChannel = event.subject.QueryInterface(Ci.nsIHttpChannel);

	if (httpChannel.URI.host && httpChannel.URI.host == 'mobile.tyrantonline.com') {
		var traceableChannel = event.subject.QueryInterface(Ci.nsITraceableChannel);
		newListener.originalListener = traceableChannel.setNewListener(newListener);
	}
}

// Add event listener to the 'http-on-examine-response' event
Events.on("http-on-examine-response", httpResponseExamineListener);