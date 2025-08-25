function includeJSfiles() {
  build_includeFile_line("loader.js");
  build_includeFile_line("freemaster-client.js");
  build_includeFile_line("jquery-3.7.1.min.js");
  build_includeFile_line("simple-jsonrpc-js.js");
  build_includeFile_line("utils.js");
  build_includeFile_line("components.js");
}

function build_includeFile_line(jsFileName) {
  document.write(
    "<scr" +
      'ipt type="text/javascript" src="./assets/js/' +
      jsFileName +
      '" ></scr' +
      "ipt>"
  );
}
