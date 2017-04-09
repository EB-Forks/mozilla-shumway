/*
 * Copyright 2017 Mozilla Foundation
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

const MAX_USER_INPUT_TIMEOUT = 250; // ms

function getBoolPref(pref, def) {
  console.warn("TODO:", "getBoolPref(pref=" + pref + ", def=" + def + ");");
}

function getCharPref(pref, def) {
  console.warn("TODO:", "getCharPref(pref=" + pref + ", def=" + def + ");");
}

function log(aMsg) {
  let msg = 'ShumwayCom.js: ' + (aMsg.join ? aMsg.join('') : aMsg);
  console.log(msg);
  dump(msg + '\n');
}

function sanitizeTelemetryArgs(args) {
  var request = {
    topic: String(args.topic)
  };
  switch (request.topic) {
    case 'firstFrame':
      break;
    case 'parseInfo':
      request.info = {
        parseTime: +args.parseTime,
        size: +args.bytesTotal,
        swfVersion: args.swfVersion | 0,
        frameRate: +args.frameRate,
        width: args.width | 0,
        height: args.height | 0,
        bannerType: args.bannerType | 0,
        isAvm2: !!args.isAvm2
      };
      break;
    case 'feature':
      request.featureType = args.feature | 0;
      break;
    case 'loadResource':
      request.resultType = args.resultType | 0;
      break;
    case 'error':
      request.errorType = args.error | 0;
      break;
  }
  return request;
}

function sanitizeLoadFileArgs(args) {
  return {
    url: String(args.url || ''),
    checkPolicyFile: !!args.checkPolicyFile,
    sessionId: +args.sessionId,
    limit: +args.limit || 0,
    mimeType: String(args.mimeType || ''),
    method: (args.method + '') || 'GET',
    postData: args.postData || null
  };
}

function sanitizeExternalComArgs(args) {
  var request = {
    action: String(args.action)
  };
  switch (request.action) {
    case 'eval':
      request.expression = String(args.expression);
      break;
    case 'call':
      request.expression = String(args.request);
      break;
    case 'register':
    case 'unregister':
      request.functionName = String(args.functionName);
      break;
  }
  return request;
}

var cloneIntoFromContent = (function () {
  console.warn("TODO:", "cloneIntoFromContent = (function () {...})();");
  return function (obj, contentSandbox) {
    console.warn("TODO:", "cloneIntoFromContent(obj=" + obj + ", contentSandbox=" + contentSandbox + ");");
  }
})();

var ShumwayEnvironment = {
  DEBUG: 'debug',
  DEVELOPMENT: 'dev',
  RELEASE: 'release',
  TEST: 'test'
};

var ShumwayCom = {
  environment: getCharPref('shumway.environment', 'dev'),

  createAdapter: function (content, callbacks, hooks) {
    // Exposing ShumwayCom object/adapter to the unprivileged content -- setting
    // up Xray wrappers.
    var wrapped = {
      environment: ShumwayCom.environment,

      enableDebug: function () {
        callbacks.enableDebug()
      },

      fallback: function () {
        callbacks.sendMessage('fallback', null, false);
      },

      getSettings: function () {
        return cloneInto(
          callbacks.sendMessage('getSettings', null, true), content);
      },

      getPluginParams: function () {
        return cloneInto(
          callbacks.sendMessage('getPluginParams', null, true), content);
      },

      reportIssue: function () {
        callbacks.sendMessage('reportIssue', null, false);
      },

      reportTelemetry: function (args) {
        var request = sanitizeTelemetryArgs(args);
        callbacks.sendMessage('reportTelemetry', request, false);
      },

      setupGfxComBridge: function (gfxWindow) {
        // Creates ShumwayCom adapter for the gfx iframe exposing only subset
        // of the privileged function. Removing Xrays to setup the ShumwayCom
        // property and for usage as a sandbox for cloneInto operations.
        var gfxContent = gfxWindow.contentWindow.wrappedJSObject;
        ShumwayCom.createGfxAdapter(gfxContent, callbacks, hooks);

        setupUserInput(gfxWindow.contentWindow, callbacks);
      },

      setupPlayerComBridge: function (playerWindow) {
        // Creates ShumwayCom adapter for the player iframe exposing only subset
        // of the privileged function. Removing Xrays to setup the ShumwayCom
        // property and for usage as a sandbox for cloneInto operations.
        var playerContent = playerWindow.contentWindow.wrappedJSObject;
        ShumwayCom.createPlayerAdapter(playerContent, callbacks, hooks);
      }
    };

    var shumwayComAdapter = cloneInto(wrapped, content, {cloneFunctions:true});
    content.ShumwayCom = shumwayComAdapter;
  },

  createGfxAdapter: function (content, callbacks, hooks) {
    // Exposing ShumwayCom object/adapter to the unprivileged content -- setting
    // up Xray wrappers.
    var wrapped = {
      environment: ShumwayCom.environment,

      setFullscreen: function (value) {
        value = !!value;
        callbacks.sendMessage('setFullscreen', value, false);
      },

      reportTelemetry: function (args) {
        var request = sanitizeTelemetryArgs(args);
        callbacks.sendMessage('reportTelemetry', request, false);
      },

      postAsyncMessage: function (msg) {
        if (hooks.onPlayerAsyncMessageCallback) {
          hooks.onPlayerAsyncMessageCallback(msg);
        }
      },

      setSyncMessageCallback: function (callback) {
        if (typeof callback !== 'function') {
          log('error: attempt to set non-callable as callback in setSyncMessageCallback');
          return;
        }
        hooks.onGfxSyncMessageCallback = function (msg, sandbox) {
          var reclonedMsg = cloneIntoFromContent(msg, content);
          var result = callback(reclonedMsg);
          return cloneIntoFromContent(result, sandbox);
        };
      },

      setAsyncMessageCallback: function (callback) {
        if (typeof callback !== 'function') {
          log('error: attempt to set non-callable as callback in setAsyncMessageCallback');
          return;
        }
        hooks.onGfxAsyncMessageCallback = function (msg) {
          var reclonedMsg = cloneIntoFromContent(msg, content);
          callback(reclonedMsg);
        };
      }
    };

    if (ShumwayCom.environment === ShumwayEnvironment.TEST) {
      wrapped.processFrame = function () {
        callbacks.sendMessage('processFrame');
      };

      wrapped.processFSCommand = function (command, args) {
        callbacks.sendMessage('processFSCommand', command, args);
      };

      wrapped.setScreenShotCallback = function (callback) {
        callbacks.sendMessage('setScreenShotCallback', callback);
      };
    }

    var shumwayComAdapter = cloneInto(wrapped, content, {cloneFunctions:true});
    content.ShumwayCom = shumwayComAdapter;
  },

  createPlayerAdapter: function (content, callbacks, hooks) {
    console.warn("TODO:", "createPlayerAdapter(content=" + content + ", callbacks=" + callbacks + ", hooks=" + hooks + ");");
  },

  createActions: function (startupInfo, window, document) {
    return new ShumwayChromeActions(startupInfo, window, document);
  }
}

// All the privileged actions.
class ShumwayChromeActions {
  constructor (startupInfo, window, document) {
    this.url = startupInfo.url;
    this.objectParams = startupInfo.objectParams;
    this.movieParams = startupInfo.movieParams;
    this.baseUrl = startupInfo.baseUrl;
    this.isOverlay = startupInfo.isOverlay;
    this.embedTag = startupInfo.embedTag;
    this.isPausedAtStart = startupInfo.isPausedAtStart;
    this.initStartTime = startupInfo.initStartTime;
    this.window = window;
    this.document = document;
    this.allowScriptAccess = startupInfo.allowScriptAccess;
    this.lastUserInput = 0;
    this.telemetry = {
      startTime: Date.now(),
      features: [],
      errors: []
    };

    this.fileLoader = new FileLoader(startupInfo.url, startupInfo.baseUrl, startupInfo.refererUrl,
      function (args) { this.onLoadFileCallback(args); }.bind(this));
    this.onLoadFileCallback = null;

    this.externalInterface = null;
    this.onExternalCallback = null;
  }

  // The method is created for convenience of routing messages from the OOP
  // handler or remote debugger adapter. All method calls are originated from
  // the ShumwayCom adapter (see above), or from the debugger adapter.
  // See viewerWrapper.js for these usages near sendMessage calls.
  invoke (name, args) {
    return this[name].call(this, args);
  }

  getBoolPref (data) {
    if (!/^shumway\./.test(data.pref)) {
      return null;
    }
    return getBoolPref(data.pref, data.def);
  }

  getSettings () {
    return {
      compilerSettings: {
        appCompiler: getBoolPref('shumway.appCompiler', true),
        sysCompiler: getBoolPref('shumway.sysCompiler', false),
        verifier: getBoolPref('shumway.verifier', true)
      },
      playerSettings: {
        turboMode: getBoolPref('shumway.turboMode', false),
        hud: getBoolPref('shumway.hud', false),
        forceHidpi: getBoolPref('shumway.force_hidpi', false)
      }
    }
  }

  getPluginParams () {
    return {
      url: this.url,
      baseUrl : this.baseUrl,
      movieParams: this.movieParams,
      objectParams: this.objectParams,
      isOverlay: this.isOverlay,
      isPausedAtStart: this.isPausedAtStart,
      initStartTime: this.initStartTime,
      isDebuggerEnabled: getBoolPref('shumway.debug.enabled', false)
    };
  }

  navigateTo (data) {
    console.warn("TODO:", "navigateTo(data=" + data + ");");
  }

  fallback (automatic) {
    automatic = !!automatic;
    var event = this.document.createEvent('CustomEvent');
    event.initCustomEvent('shumwayFallback', true, true, {
      automatic: automatic
    });
    this.window.dispatchEvent(event);
  }

  userInput () {
    // Recording time of last user input for isUserInputInProgress below.
    this.lastUserInput = Date.now();
  }

  isUserInputInProgress () {
    // We don't trust our Shumway non-privileged code just yet to verify the
    // user input -- using userInput function above to track that.
    if ((Date.now() - this.lastUserInput) > MAX_USER_INPUT_TIMEOUT) {
      return false;
    }
    // TODO other security checks?
    return true;
  }

  setClipboard (data) {
    if (!this.isUserInputInProgress()) {
      return;
    }

    console.warn("TODO:", "setClipboard(data=" + data + ");");
  }

  setFullscreen (enabled) {
    if (!this.isUserInputInProgress()) {
      return;
    }

    /** @type Element */
    var target = this.embedTag || this.document.body;
    if (enabled) {
      try {
        target.requestFullscreen();
      } catch (e) {
        target.mozRequestFullscreen();
      }
    } else {
      try {
        target.ownerDocument.requestFullscreen();
      } catch (e) {
        target.ownerDocument.mozRequestFullscreen();
      }
    }
  }

  reportTelemetry (request) {
    console.warn("TODO:", "reportTelemetry(request=" + request + ");");
  }

  reportIssue (exceptions) {
    console.warn("TODO:", "reportIssue(exceptions=" + exceptions + ");");
  }

  externalCom (data) {
    if (!this.allowScriptAccess) {
      return;
    }

    console.warn("TODO:", "externalCom(data=" + data + ");");
  }

  postMessage (type, data) {
    console.warn("TODO:", "postMessage(type=" + type + ", data=" + data + ");");
  }

  processFrame () {
    this.postMessage('processFrame');
  }

  processFSCommand (command, data) {
    this.postMessage('processFSCommand', { command: command, data: data });
  }

  print (msg) {
    this.postMessage('print', msg);
  }

  setScreenShotCallback (callback) {
    console.warn("TODO:", "setScreenShotCallback(callback=" + callback + ");");
  }
}