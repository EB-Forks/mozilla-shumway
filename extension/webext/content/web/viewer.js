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

let startupInfo;
const loadedPromise = new Promise (resolve => {
  window.addEventListener('message', async e => {
    const args = e.data;
    console.log('[shumway:viewer]',args);
    if (typeof args !== 'object' || args === null) {
      return;
    }
    if (args.type === 'swf') {
      startupInfo = args.startupInfo;
    }
    resolve();
  });
});

let movieUrl, movieParams;

async function runViewer() {
  await loadedPromise;
  const flashParams = {
    url:               startupInfo.url,
    baseUrl:           startupInfo.baseUrl,
    movieParams:       startupInfo.movieParams,
    objectParams:      startupInfo.objectParams,
    isOverlay:         startupInfo.isOverlay,
    isPausedAtStart:   startupInfo.isPausedAtStart,
    initStartTime:     startupInfo.initStartTime,
    isDebuggerEnabled: false
  };

  movieUrl = flashParams.url;
  if (!movieUrl) {
    console.log('no movie url provided -- stopping here');
    return;
  }

  movieParams           = flashParams.movieParams;
  var objectParams      = flashParams.objectParams;
  var baseUrl           = flashParams.baseUrl;
  var isOverlay         = flashParams.isOverlay;
  var isDebuggerEnabled = flashParams.isDebuggerEnabled;
  var initStartTime     = flashParams.initStartTime;

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
    if (objectParams.wmode === 'transparent') {
      backgroundColor = 0;
    }
  }

  playerReady.then(function () {
    var settings = ShumwayCom.getSettings();
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
    }, '*');
  });
}

window.addEventListener('message', async e => {
  const args = e.data;
  if (typeof args !== 'object' || args === null) {
    return;
  }
  if (gfxWindow && e.source === gfxWindow) {
    switch (args.callback) {
      case 'displayParameters':
        // The display parameters data will be send to the player window.
        // TODO do we need sanitize it?
        //displayParametersResolved(args.params);
        break;
      case 'showURL':
        //showURL();
        break;
      case 'showInInspector':
        //showInInspector();
        break;
      case 'reportIssue':
        //reportIssue();
        break;
      case 'showAbout':
        //showAbout();
        break;
      case 'enableDebug':
        //enableDebug();
        break;
      case 'fallback':
        //fallback();
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
});

let playerWindow, gfxWindow;

// We need to wait for gfx window to report display parameters before we
// start SWF playback in the player window.
let displayParametersResolved;
const displayParametersReady = new Promise(function (resolve) {
  displayParametersResolved = resolve;
});

const playerReady = new Promise(function (resolve) {
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
  document.getElementById('gfxIframe').src = 'viewer.gfx.xhtml';
  document.getElementById('playerIframe').addEventListener('load', iframeLoaded);
  document.getElementById('playerIframe').src = 'viewer.player.xhtml';
});
