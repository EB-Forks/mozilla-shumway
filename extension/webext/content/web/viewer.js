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

var movieUrl, movieParams;
var release = true;

function parseQueryString(qs) {
  if (!qs)
    return {};

  if (qs.charAt(0) === '?')
    qs = qs.slice(1);

  var values = qs.split('&');
  var obj = {};
  for (var i = 0; i < values.length; i++) {
    var kv = values[i].split('=');
    var key = kv[0], value = kv[1];
    obj[decodeURIComponent(key)] = decodeURIComponent(value);
  }

  return obj;
}

function getPluginParams() {
  var params = parseQueryString(window.location.search);
  return {
    baseUrl: params.base || document.location.href,
    url: params.swf,
    movieParams: {},
    objectParams: {
      wmode: null
    },
    compilerSettings: {
      sysCompiler: true,
      appCompiler: true,
      verifier: true,
      forceHidpi: (typeof params.forceHidpi === "undefined") ? false : !!params.forceHidpi
    }
  };
}

var gfxWindow, playerWindow;

function runViewer(params) {
  var flashParams = {
    url: params.url,
    baseUrl: params.baseUrl || params.url,
    movieParams: params.movieParams || {},
    objectParams: params.objectParams || {},
    compilerSettings: params.compilerSettings || {
      sysCompiler: true,
      appCompiler: true,
      verifier: true
    },
    isRemote: params.isRemote,
    bgcolor: undefined,
    displayParameters: {}
  };
  movieUrl = flashParams.url;
  movieParams = flashParams.movieParams;

  movieUrl = flashParams.url;
  if (!movieUrl) {
    console.log("no movie url provided -- stopping here");
    return;
  }

  movieParams = flashParams.movieParams;
  var objectParams = flashParams.objectParams;
  var baseUrl = flashParams.baseUrl;
  var isOverlay = flashParams.isOverlay;
  var isDebuggerEnabled = flashParams.isDebuggerEnabled;
  var initStartTime = flashParams.initStartTime;

  if (movieParams.fmt_list && movieParams.url_encoded_fmt_stream_map) {
    // HACK removing FLVs from the fmt_list
    movieParams.fmt_list = movieParams.fmt_list.split(',').filter(function (s) {
      var fid = s.split('/')[0];
      return fid !== '5' && fid !== '34' && fid !== '35'; // more?
    }).join(',');
  }

  var backgroundColor;
  if (objectParams) {
    var m;
    if (objectParams.bgcolor && (m = /#([0-9A-F]{6})/i.exec(objectParams.bgcolor))) {
      var hexColor = parseInt(m[1], 16);
      backgroundColor = hexColor << 8 | 0xff;
    }
    if (objectParams.wmode !== undefined && objectParams.wmode === 'transparent') {
      backgroundColor = 0;
    }
  }

  playerReady.then(function () {
    var settings = getSettings(flashParams);
    var playerSettings = settings.playerSettings;

    ShumwayCom.setupPlayerComBridge(document.getElementById('playerIframe'));
    parseSwf(movieUrl, baseUrl, movieParams, objectParams, settings, initStartTime, backgroundColor);

    if (isOverlay) {
      if (isDebuggerEnabled) {
        document.getElementById('overlay').className = 'enabled';
        var fallbackDiv = document.getElementById('fallback');
        fallbackDiv.addEventListener('click', function (e) {
          fallback();
          e.preventDefault();
        });
        var reportDiv = document.getElementById('report');
        reportDiv.addEventListener('click', function (e) {
          reportIssue();
          e.preventDefault();
        });
      }
    }

    ShumwayCom.setupGfxComBridge(document.getElementById('gfxIframe'));
    gfxWindow.postMessage({
      type: 'prepareUI',
      params: {
        isOverlay: isOverlay,
        isDebuggerEnabled: isDebuggerEnabled,
        isHudOn: playerSettings.hud,
        backgroundColor: backgroundColor
      }
    }, '*')
  });
}

function getSettings(flashParams) {
  var settings = {
    playerSettings: {
      hud: false
    },
    compilerSettings: flashParams.compilerSettings || {}
  };
  // TODO: Can't access browser from iframe
//  try {
//    browser.storage.local.get({
//      playerSettings: {
//        hud: false
//      },
//      compilerSettings: flashParams.compilerSettings || {}
//    }).then((data) => {
//      settings = data
//    }).catch((error) => {
//      console.warning("[Shumway]", "Couldn't get settings:", error);
//    });
//  } catch (error) {
//    console.error("[Shumway]", "Couldn't access settings:", error);
//  }
  return settings;
}

window.addEventListener("message", function handlerMessage(e) {
  var args = e.data;
  if (typeof args !== 'object' || args === null) {
    return;
  }
  if (gfxWindow && e.source === gfxWindow) {
    switch (args.callback) {
      case 'displayParameters':
        // The display parameters data will be send to the player window.
        // TODO do we need sanitize it?
       displayParametersResolved(args.params);
        break;
      case 'showURL':
        showURL();
        break;
      case 'showInInspector':
        showInInspector();
        break;
      case 'reportIssue':
        reportIssue();
        break;
      case 'showAbout':
        showAbout();
        break;
      case 'enableDebug':
        enableDebug();
        break;
      case 'fallback':
        fallback();
        break;
      default:
        console.error('Unexpected message from gfx frame: ' + args.callback);
        break;
    }
  }
  if (playerWindow && e.source === playerWindow) {
    switch (args.callback) {
      case 'started':
        document.body.classList.add('started');
        break;
      default:
        console.error('Unexpected message from player frame: ' + args.callback);
        break;
    }
  }
}, true);

function waitForParametersMessage(e) {
  if (e.data && typeof e.data === 'object' && e.data.type === 'pluginParams') {
    window.removeEventListener('message', waitForParametersMessage);
    runViewer(e.data.flashParams);
  }
}

function parseSwf(url, baseUrl, movieParams, objectParams, settings,
                  initStartTime, backgroundColor) {
  var compilerSettings = settings.compilerSettings;
  var playerSettings = settings.playerSettings;

  displayParametersReady.then(function (displayParameters) {
    var data = {
      type: 'runSwf',
      flashParams: {
        compilerSettings: compilerSettings,
        movieParams: movieParams,
        objectParams: objectParams,
        displayParameters: displayParameters,
        turboMode: playerSettings.turboMode,
        env: playerSettings.env,
        bgcolor: backgroundColor,
        url: url,
        baseUrl: baseUrl || url,
        initStartTime: initStartTime
      }
    };
    playerWindow.postMessage(data, '*');
  });
}

// We need to wait for gfx window to report display parameters before we
// start SWF playback in the player window.
var displayParametersResolved;
var displayParametersReady = new Promise(function (resolve) {
  displayParametersResolved = resolve;
});

var playerReady = new Promise(function (resolve) {
  function iframeLoaded() {
    if (--iframesToLoad > 0) {
      return;
    }

    gfxWindow = document.getElementById('gfxIframe').contentWindow;
    playerWindow = document.getElementById('playerIframe').contentWindow;
    resolve();
  }

  var iframesToLoad = 2;
  document.getElementById('gfxIframe').addEventListener('load', iframeLoaded);
  document.getElementById('gfxIframe').src = getURL("content/web/viewer.gfx.html");
  document.getElementById('playerIframe').addEventListener('load', iframeLoaded);
  document.getElementById('playerIframe').src = getURL("content/web/viewer.player.html");
});

playerReady.then(function() {
  gfxWindow = document.getElementById('gfxIframe').contentWindow;
  playerWindow = document.getElementById('playerIframe').contentWindow;

  var flashParams = getPluginParams();
  if (!flashParams.url) {
    // no movie url provided -- waiting for parameters via postMessage
    window.addEventListener('message', waitForParametersMessage);
  } else {
    runViewer(flashParams);
  }
});

// Inter-Process Functions

function fallback() {
  ShumwayCom.fallback();
}

function showURL() {
  window.prompt("Copy to clipboard", movieUrl);
}

function showInInspector() {
  var base = "http://www.areweflashyet.com/shumway/examples/inspector/inspector.html?rfile=";
  var params = '';
  for (var k in movieParams) {
    params += '&' + k + '=' + encodeURIComponent(movieParams[k]);
  }
  window.open(base + encodeURIComponent(movieUrl) + params);
}

function reportIssue() {
  //var duplicatesMap = Object.create(null);
  //var prunedExceptions = [];
  //avm2.exceptions.forEach(function(e) {
  //  var ident = e.source + e.message + e.stack;
  //  var entry = duplicatesMap[ident];
  //  if (!entry) {
  //    entry = duplicatesMap[ident] = {
  //      source: e.source,
  //      message: e.message,
  //      stack: e.stack,
  //      count: 0
  //    };
  //    prunedExceptions.push(entry);
  //  }
  //  entry.count++;
  //});
  //ShumwayCom.reportIssue(JSON.stringify(prunedExceptions));
  //ShumwayCom.reportIssue();
}

function showAbout() {
  window.open('http://areweflashyet.com/');
}

function enableDebug() {
  ShumwayCom.enableDebug();
}