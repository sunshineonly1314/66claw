{
  "targets": [
    {
      "target_name": "clawdbot_native",
      "sources": [
        "src/addon.cc",
        "src/rsa_verify.cc",
        "src/integrity_check.cc",
        "src/anti_debug.cc",
        "src/string_vault.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(node -p \"require('path').join(require('path').dirname(process.execPath), '..', 'include', 'node')\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-fstack-protector-strong", "-D_FORTIFY_SOURCE=2"],
      "cflags_cc": ["-std=c++17", "-O2", "-fstack-protector-strong", "-D_FORTIFY_SOURCE=2"],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "NODE_ADDON_API_ENABLE_MAYBE"
      ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "BufferSecurityCheck": "true",
              "AdditionalOptions": ["/std:c++17", "/O2", "/GS", "/sdl"]
            }
          },
          "include_dirs": [
            "<!@(node -p \"require('path').join(require('path').dirname(process.execPath), '..', 'include', 'node')\")"
          ],
          "libraries": [
            "-lcrypt32",
            "-ladvapi32",
            "-lkernel32",
            "<!@(node -p \"require('path').join(require('path').dirname(process.execPath), '..', 'lib', 'libcrypto.lib')\")"
          ]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "11.0",
            "GCC_OPTIMIZATION_LEVEL": "2",
            "GCC_NO_COMMON_BLOCKS": "YES",
            "ENABLE_STRICT_OBJC_MSGSEND": "YES",
            "OTHER_CFLAGS": "-fstack-protector-strong -D_FORTIFY_SOURCE=2"
          },
          "libraries": [
            "-framework Security",
            "-framework CoreFoundation",
            "-lcrypto",
            "-lssl"
          ]
        }],
        ["OS=='linux'", {
          "libraries": [
            "-lcrypto",
            "-lssl"
          ]
        }]
      ]
    }
  ]
}
