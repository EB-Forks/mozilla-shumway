/*
 * Copyright 2013 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The non-browser specific extension address.
 * @type {String}
 * @author ExE Boss
 */
const extension_url = window.location.protocol + "//" + window.location.host + '/';

/**
 * Converts a relative path within an add-on's install directory to a fully-qualified URL.
 *
 * @param {String} path The path, relative to manifest.json.
 * @return {String} The same result as calling <a href="https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/extension/getURL">
 * <code>browser.extension.getURL(path)</code></a>.
 * @see <a href="https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/extension/getURL">
 * <code>browser.extension.getURL(path)</code></a>
 * @author ExE Boss
 */
function getURL(path) {
  if (path.charAt(0) === '/')
    path = path.slice(1);

  return extension_url + path;
}

var release = true;

var viewerPlayerglobalInfo = {
  abcs: "../build/playerglobal/playerglobal.abcs",
  catalog: "../build/playerglobal/playerglobal.json"
};

var builtinPath = "../build/libs/builtin.abc";

window.print = function (msg) {
  console.log(msg);
};

Shumway.Telemetry.instance = {
  reportTelemetry: function (data) { }
};

var player;

var iframeExternalInterface = {
  onExternalCallback: null,
  processExternalCommand: null,

  get enabled() {
    return !!this.processExternalCommand;
  },

  initJS: function (callback) {
    this.processExternalCommand({action: 'init'});
    this.onExternalCallback = function (functionName, args) {
      return callback(functionName, args);
    };
  },

  registerCallback: function (functionName) {
    var cmd = {action: 'register', functionName: functionName, remove: false};
    this.processExternalCommand(cmd);
  },

  unregisterCallback: function (functionName) {
    var cmd = {action: 'register', functionName: functionName, remove: true};
    this.processExternalCommand(cmd);
  },

  eval: function (expression) {
    var cmd = {action: 'eval', expression: expression};
    this.processExternalCommand(cmd);
    return cmd.result;
  },

  call: function (request) {
    var cmd = {action: 'call', request: request};
    this.processExternalCommand(cmd);
    return cmd.result;
  },

  getId: function () {
    var cmd = {action: 'getId'};
    this.processExternalCommand(cmd);
    return cmd.result;
  }
};

function runSwfPlayer(flashParams, settings) {
  if (settings) {
    Shumway.Settings.setSettings(settings);
  }
  var compilerSettings = flashParams.compilerSettings;
  var asyncLoading = true;
  var baseUrl = flashParams.baseUrl;
  var movieUrl = flashParams.url;
  Shumway.SystemResourcesLoadingService.instance =
    new Shumway.Player.BrowserSystemResourcesLoadingService(builtinPath, viewerPlayerglobalInfo);
  Shumway.createSecurityDomain(Shumway.AVM2LoadLibrariesFlags.Builtin | Shumway.AVM2LoadLibrariesFlags.Playerglobal).then(function (securityDomain) {
    function runSWF(file, buffer, baseUrl) {
      var movieParams = flashParams.movieParams;
      var objectParams = flashParams.objectParams;

      var peer = new Shumway.Remoting.ShumwayComTransportPeer();
      var gfxService = new Shumway.Player.Window.WindowGFXService(securityDomain, peer);
      player = new Shumway.Player.Player(securityDomain, gfxService);
      player.defaultStageColor = flashParams.bgcolor;
      player.movieParams = movieParams;
      player.stageAlign = (objectParams && (objectParams.salign || objectParams.align)) || '';
      player.stageScale = (objectParams && objectParams.scale) || 'showall';
      player.displayParameters = flashParams.displayParameters;

      player.pageUrl = baseUrl;
      player.load(file, buffer);

      var parentDocument = window.parent.document;
      var event = parentDocument.createEvent('CustomEvent');
      event.initCustomEvent('shumwaystarted', true, true, null);
      parentDocument.dispatchEvent(event);
      document.body.style.backgroundColor = 'green';
    }

    Shumway.FileLoadingService.instance = flashParams.isRemote ?
      new RemoteFileLoadingService() :
      new Shumway.Player.BrowserFileLoadingService();
    Shumway.FileLoadingService.instance.init(baseUrl);
    if (!flashParams.isRemote) {
      Shumway.ExternalInterfaceService.instance = iframeExternalInterface;
    }

    if (asyncLoading) {
      runSWF(movieUrl, undefined, baseUrl);
    } else {
      new Shumway.BinaryFileReader(movieUrl).readAll(null, function(buffer, error) {
        if (!buffer) {
          throw "Unable to open the file " + file + ": " + error;
        }
        runSWF(movieUrl, buffer, baseUrl);
      });
    }
  });
}

function RemoteFileLoadingService() {
  this._baseUrl = null;
  this._nextSessionId = 1;
  this._sessions = [];
}
RemoteFileLoadingService.prototype = {
  init: function (baseUrl) {
    this._baseUrl = baseUrl;
    var service = this;
    window.addEventListener('message', function (e) {
      var data = e.data;
      if (typeof data !== 'object' || data === null ||
          data.type !== 'shumwayFileLoadingResponse') {
        return;
      }
      var session = service._sessions[data.sessionId];
      if (session) {
        service._notifySession(session, data);
      }
    });
  },

  _notifySession: function (session, args) {
    var sessionId = args.sessionId;
    switch (args.topic) {
      case "open":
        session.onopen();
        break;
      case "close":
        session.onclose();
        this._sessions[sessionId] = null;
        console.log('Session #' + sessionId + ': closed');
        break;
      case "error":
        session.onerror && session.onerror(args.error);
        break;
      case "progress":
        console.log('Session #' + sessionId + ': loaded ' + args.loaded + '/' + args.total);
        var data = args.array;
        if (!(data instanceof Uint8Array)) {
          data = new Uint8Array(data);
        }
        session.onprogress && session.onprogress(data, {bytesLoaded: args.loaded, bytesTotal: args.total});
        break;
    }
  },

  createSession: function () {
    var sessionId = this._nextSessionId++;
    var service = this;
    var session = {
      open: function (request) {
        var path = service.resolveUrl(request.url);
        console.log('Session #' + sessionId + ': loading ' + path);
        window.parent.parent.postMessage({type: 'shumwayFileLoading', url: path, method: request.method,
          mimeType: request.mimeType, postData: request.data,
          checkPolicyFile: request.checkPolicyFile, sessionId: sessionId}, '*');
      },
      close: function () {
        if (service._sessions[sessionId]) {
          // TODO send abort
        }
      }
    };
    return (this._sessions[sessionId] = session);
  },

  resolveUrl: function (url) {
    return new URL(url, this._baseUrl).href;
  },

  navigateTo: function (url, target) {
    window.open(this.resolveUrl(url), target || '_blank');
  }
};

function setupServices() {
  Shumway.Telemetry.instance = new Shumway.Player.ShumwayComTelemetryService();
  Shumway.ExternalInterfaceService.instance = new Shumway.Player.ShumwayComExternalInterface();
  Shumway.ClipboardService.instance = new Shumway.Player.ShumwayComClipboardService();
  Shumway.FileLoadingService.instance = new Shumway.Player.ShumwayComFileLoadingService();
  Shumway.SystemResourcesLoadingService.instance = new Shumway.Player.ShumwayComResourcesLoadingService(true);
  Shumway.LocalConnectionService.instance = new Shumway.Player.ShumwayComLocalConnectionService();
}

// Inter-Process Functions

function playerStarted() {
  document.body.style.backgroundColor = 'green';
  window.parent.postMessage({
    callback: 'started'
  }, '*');
}

window.addEventListener('message', function onWindowMessage(e) {
  var data = e.data;
  if (typeof data !== 'object' || data === null) {
    console.error('Unexpected message for player frame.');
    return;
  }
  switch (data.type) {
    case "runSwf":
      if (data.settings) {
        Shumway.Settings.setSettings(data.settings);
      }
      setupServices();
      runSwfPlayer(data.flashParams, data.settings);
      break;
    default:
      console.error('Unexpected message for player frame: ' + args.callback);
      break;
  }
}, true);
