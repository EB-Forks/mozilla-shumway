var BinaryFileReader = (function binaryFileReader() {
  function constructor(url, responseType) {
    this.url = url;
    this.responseType = responseType || "arraybuffer";
  }

  constructor.prototype = {
    readAll: function(progress, complete) {
      var xhr = new XMLHttpRequest();
      var async = true;
      xhr.open("GET", this.url, async);
      xhr.responseType = this.responseType;
      if (progress) {
        xhr.onprogress = function(event) {
          progress(xhr.response, event.loaded, event.total);
        };
      }
      xhr.onreadystatechange = function(event) {
        if (xhr.readyState === 4) {
          complete(xhr.response);
        }
      }
      xhr.setRequestHeader("If-Modified-Since", "Fri, 01 Jan 1960 00:00:00 GMT"); // no-cache
      xhr.send(null);
    }
  };
  return constructor;
})();

(function checkWeakMap() {
  if (typeof this.WeakMap === 'function')
    return; // weak map is supported

  var id = 0;
  function WeakMap() {
    this.id = '$weakmap' + (id++);
  };
  WeakMap.prototype = {
    has: function(obj) {
      return this.id in obj;
    },
    get: function(obj, defaultValue) {
      return this.id in obj ? obj[this.id] : defaultValue;
    },
    set: function(obj, value) {
      Object.defineProperty(obj, this.id, {
        value: value,
        enumerable: false,
        configurable: true
      });
    }
  };
  this.WeakMap = WeakMap;
})();

/**
 * Creates an AVM2 instance.
 * @param {string} builtinPath Path to the builtin.abc file.
 * @param {string} libraryPath Path to the second .abc file to be executed.
 * @param {EXECUTION_MODE} sysMode Execution mode for code in the system domain.
 * @param {EXECUTION_MODE} appMode Execution mode for code in the application domain.
 * @param {Function} next Callback called after the VM is created.
 */
function createAVM2(builtinPath, libraryPath, sysMode, appMode, next) {
  assert (builtinPath);
  new BinaryFileReader(builtinPath).readAll(null, function (buffer) {
    var vm = new AVM2(sysMode, appMode);
    vm.systemDomain.executeAbc(new AbcFile(new Uint8Array(buffer), "builtin.abc"));
    if (libraryPath) {
      new BinaryFileReader(libraryPath).readAll(null, function (buffer) {
        vm.systemDomain.executeAbc(new AbcFile(new Uint8Array(buffer), libraryPath));
        next(vm);
      });
    } else {
      next(vm);
    }
  });
}

/**
 * Binds native object using specified AVM2 instance.
 * @param {Object} vm The VM instance.
 * @param {Object} obj The native object.
 * @returns {Object} The bound/script object.
 */
function bindNativeObjectUsingAvm2(vm, obj) {
  var scriptClass = vm.applicationDomain.getProperty(
    Multiname.fromSimpleName('public ' + obj.__class__),
    true,
    true
  );
  return scriptClass.createInstanceWithBoundNative(obj, true);
}