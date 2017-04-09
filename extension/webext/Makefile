# Copyright 2013 Mozilla Foundation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

UTILS_HOME = ../../utils
CLOSURE ?= $(UTILS_HOME)/closure.jar
BUILD_DIR = ../../build/webext
PROFILE ?= $(error Specify Firefox profile in PROFILE)
BUNDLES_DIR = ../../build/bundles-cc

# Just builds a ff extension

VERSION = `head -n 1 ../../build/version/version.txt`

build: ensureoutputdir
	# Copying extension files
	echo "Creating extension version: $(VERSION)"
	cp -R ../../LICENSE ../../LICENSE-OFL.txt ../../README-LICENSE.txt content chrome manifest.json icon.png icon64.png $(BUILD_DIR)/
	sed s/\(SHUMWAY_VERSION\)/$(VERSION)/ manifest.json > $(BUILD_DIR)/manifest.json
	cp ../../examples/inspector/debug/pingpong.js $(BUILD_DIR)/chrome/
	# Copying JavaScript content files
	mkdir -p $(BUILD_DIR)/content/playerglobal
	cp ../../build/playerglobal/playerglobal.json $(BUILD_DIR)/content/playerglobal/
	cp ../../build/playerglobal/playerglobal.abcs $(BUILD_DIR)/content/playerglobal/
	# Copying ABC and Relooper files
	mkdir -p $(BUILD_DIR)/content/libs
	cp ../../build/libs/builtin.abc $(BUILD_DIR)/content/libs/
	cp ../../build/libs/relooper.js $(BUILD_DIR)/content/libs/
	# Copying closure optimized shumway.js files
	cp $(BUNDLES_DIR)/shumway*.js $(BUILD_DIR)/content/
	cp ../../build/version/version.txt $(BUILD_DIR)/content/version.txt
	echo "web-extension" >> $(BUILD_DIR)/content/version.txt
	# Packaging XPI file
	cd $(BUILD_DIR); web-ext build
	cp $(BUILD_DIR)/web-ext-artifacts/shumway-$(VERSION).zip $(BUILD_DIR)/shumway.xpi

ensureoutputdir: clean
	-mkdir -p $(BUILD_DIR)

clean:
	-rm -rf build
	-rm -rf $(BUILD_DIR)

PHONY: build clean ensureoutputdir
