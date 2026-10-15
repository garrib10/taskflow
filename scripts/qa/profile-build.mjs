// Diagnostic build only: no instrumentation enters npm run build / dist.
import { build } from 'vite';
import ts from 'typescript';
import MagicString from 'magic-string';
import { resolve } from 'node:path';
const components = new Set(['App','Board','Column','TaskCard','TaskDetails','TaskForm']);
const functions = new Set(['taskContexts','filterBoardColumns','selectOrderedTasks','validateBoardAction','decodeBoard','saveBoard']);
await build({
  configFile: resolve('vite.config.ts'),
  resolve: { alias: { 'react-dom/client': 'react-dom/profiling' } },
  build: { outDir: process.env.TASKFLOW_PROFILE_DIR ?? '/private/tmp/taskflow49-profile', emptyOutDir: true, sourcemap: true },
  plugins: [{ name: 'taskflow-diagnostic-only', enforce: 'pre', transform(source,id) {
    if (!id.includes('/src/') || !/\.tsx?$/.test(id)) return;
    if (id.endsWith('/main.tsx')) {
      const output = new MagicString(source);
      output.overwrite(source.indexOf('import { StrictMode }'), source.indexOf('import { StrictMode }')+'import { StrictMode }'.length, 'import { StrictMode, Profiler }');
      output.overwrite(source.indexOf('<App />'), source.indexOf('<App />')+7, '<Profiler id="App" onRender={(...args) => globalThis.__taskflowQA?.commits.push(args)}><App /></Profiler>');
      return {code:output.toString(),map:output.generateMap({hires:true,source:id,includeContent:true})};
    }
    const ast = ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true,id.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    const edits=[];
    for(const node of ast.statements) {
      if(!ts.isFunctionDeclaration(node)||!node.name||!node.body) continue;
      const name=node.name.text, start=node.body.getStart(ast)+1, end=node.body.end-1;
      if(components.has(name)) edits.push([start,`globalThis.__taskflowQA?.renders.push({name:${JSON.stringify(name)},at:performance.now()});`]);
      if(functions.has(name)) {
        edits.push([start,`const __qaStart=performance.now();try{`]);
        edits.push([end,`}finally{globalThis.__taskflowQA?.calls.push({name:${JSON.stringify(name)},ms:performance.now()-__qaStart});}`]);
      }
    }
    if(!edits.length)return;
    const output = new MagicString(source);
    for(const [offset,text] of edits)output.appendLeft(offset,text);
    return {code:output.toString(),map:output.generateMap({hires:true,source:id,includeContent:true})};
  }}],
});
