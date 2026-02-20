import React, { useState, useEffect, useRef } from 'react';
import { Video, Sparkles, Loader2, FileVideo, Settings, CheckCircle2, AlertCircle, Download, Terminal } from 'lucide-react';

// 本地 Vite 项目：使用 npm 依赖的 FFmpeg + 打包后的 core JS/wasm 资源，完全离线。
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

const DynamicForm = ({ schema, formData, onChange, onSubmit, isProcessing, progress, logs, logEndRef, isElectron }) => {
  if (!schema) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-6 border-b pb-4">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">{schema.title}</h2>
      </div>

      <div className="space-y-6">
        {schema.fields.map((field) => {
          if (field.visible_if) {
            const [conditionKey, conditionValue] = Object.entries(field.visible_if)[0];
            if (String(formData[conditionKey]) !== String(conditionValue)) return null;
          }

          return (
            <div key={field.id} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">{field.label}</label>
              
              {field.type === 'select' && (
                <select 
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                  value={formData[field.id] !== undefined ? formData[field.id] : field.default}
                  onChange={(e) => onChange(field.id, e.target.value)}
                >
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === 'switch' && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={formData[field.id] !== undefined ? formData[field.id] : field.default}
                    onChange={(e) => onChange(field.id, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-600">
                    {formData[field.id] ? '已开启' : '已关闭'}
                  </span>
                </label>
              )}

              {field.type === 'slider' && (
                <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>{field.minLabel}</span>
                    <span className="text-blue-600 font-bold text-base">
                      {formData[field.id] !== undefined ? formData[field.id] : field.default}
                    </span>
                    <span>{field.maxLabel}</span>
                  </div>
                  <input 
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step || 1}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    value={formData[field.id] !== undefined ? formData[field.id] : field.default}
                    onChange={(e) => onChange(field.id, Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        {!isProcessing ? (
          <div className="relative group">
            {isElectron ? (
              <button
                type="button"
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 group-hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]"
                onClick={async () => {
                  const r = await window.electronVideo.openFileDialog();
                  if (!r.canceled && r.path) {
                    const name = r.path.replace(/^.*[\\/]/, '');
                    onSubmit({ path: r.path, name });
                  }
                }}
              >
                <FileVideo className="w-5 h-5" />
                确认配置并选择本地视频
              </button>
            ) : (
              <>
                <input 
                  type="file" 
                  accept="video/*,.mkv,.mp4,.mov,.avi,.webm" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    if (e.target.files?.[0]) onSubmit(e.target.files[0]);
                  }}
                />
                <button className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2 group-hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]">
                  <FileVideo className="w-5 h-5" />
                  确认配置并选择本地视频
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                正在处理视频 (如果进度卡住，请查看下方日志)
              </span>
              <span className="text-sm font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-4">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            
            <div className="bg-slate-900 rounded-xl p-3 h-40 overflow-y-auto shadow-inner relative group">
              <div className="sticky top-0 bg-slate-900/90 backdrop-blur pb-2 mb-2 border-b border-slate-800 flex items-center gap-2 text-slate-400">
                <Terminal className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider font-bold">FFmpeg Engine Logs</span>
              </div>
              <pre className="text-emerald-400 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">{logs || '引擎准备中...'}</pre>
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [engineStatus, setEngineStatus] = useState("idle");
  const [logs, setLogs] = useState("");

  const ffmpegRef = useRef(new FFmpeg());
  const logEndRef = useRef(null);

  const isElectron = typeof window !== 'undefined' && !!window.electronVideo;

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const initEngine = async () => {
    if (isElectron) {
      // Electron 模式下使用本机 ffmpeg，不需要 wasm 引擎
      return true;
    }
    const ffmpeg = ffmpegRef.current;
    if (engineStatus === 'ready' && ffmpeg.loaded) return true;
    
    setEngineStatus("loading");
    setErrorMsg("");
    setLogs(prev => prev + '[系统] 开始加载本地核心引擎...\n');

    try {
      // 避免重复监听
      ffmpeg.on('progress', ({ progress }) => setProgress(Math.round(progress * 100)));
      ffmpeg.on('log', ({ message }) => setLogs(prev => prev + message + '\n'));

      setLogs(prev => prev + '[系统] 正在编译底层 WebAssembly 环境...\n');
      
      // 使用打包后的 core 文件（来自 node_modules/@ffmpeg/core）
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      setEngineStatus("ready");
      setLogs(prev => prev + '[系统] 引擎加载成功，算力就绪！\n');
      return true;

    } catch (err) {
      console.error("引擎初始化异常:", err);
      setEngineStatus("error");
      const msg = err && typeof err === 'object' && 'message' in err ? err.message : String(err);
      setErrorMsg(`初始化失败: ${msg}`);
      return false;
    }
  };

  const analyzeIntent = async () => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    setResultData(null);
    setErrorMsg("");
    setLogs("");
    setProgress(0);
    
    await new Promise(resolve => setTimeout(resolve, 800)); 

    const generatedSchema = {
      task: "transcode",
      title: "本地极速视频工作站",
      fields: [
        { id: "format", label: "输出格式", type: "select", options: ["MP4", "MKV", "WebM"], default: "MP4" },
        { id: "lossless", label: "无损模式 (Stream Copy)", type: "switch", default: true },
        { 
          id: "crf", 
          label: "画质压缩率 (CRF)", 
          type: "slider", 
          min: 18, 
          max: 35, 
          default: 23, 
          minLabel: "超清", 
          maxLabel: "极简",
          visible_if: { "lossless": false } 
        }
      ]
    };

    setSchema(generatedSchema);
    const initialData = {};
    generatedSchema.fields.forEach(f => initialData[f.id] = f.default);
    setFormData(initialData);
    setIsAnalyzing(false);
    
    initEngine();
  };

  const handleProcess = async (file) => {
    setIsProcessing(true);
    setErrorMsg("");
    setLogs(`[系统] 获取到本地文件: ${file.name}\n`);
    
    try {
      if (isElectron && window.electronVideo?.transcode) {
        setLogs(`[系统] 检测到桌面环境，使用本机 ffmpeg 执行任务...\n`);

        const inputPath = file.path || file.name;

        const stopLog = window.electronVideo.onLog((message) => {
          setLogs((prev) => prev + message);
        });

        const { success, outputPath, error, logs: finalLogs } =
          await window.electronVideo.transcode({
            inputPath,
            format: formData.format || 'MP4',
            lossless: !!formData.lossless,
            crf: formData.crf || 23,
          });

        stopLog?.();

        if (!success) {
          setLogs((prev) => prev + (finalLogs || '') + '\n');
          throw new Error(error || '本机 ffmpeg 执行失败');
        }

        setLogs((prev) => prev + (finalLogs || '') + '\n[系统] 本机转码完成。\n');

        const url = `file://${outputPath}`;
        setResultData({ url, filename: outputPath.split(/[\\/]/).pop() || 'output.mp4' });
        return;
      }

      const isReady = await initEngine();
      if (!isReady) throw new Error("引擎初始化未完成。请查看错误提示。");

      const ffmpeg = ffmpegRef.current;
      
      const inputName = `input_${Date.now()}`;
      const outputExt = formData.format.toLowerCase();
      const outputName = `output.${outputExt}`;

      setLogs(prev => prev + `[系统] 正在将文件压入内存沙盒...\n`);
      // 直接调用原生的 fetchFile
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args = ['-i', inputName];
      if (formData.lossless) {
        args.push('-c', 'copy');
      } else {
        args.push('-vcodec', 'libx264', '-crf', String(formData.crf || 23), '-preset', 'ultrafast');
      }
      args.push(outputName);

      setLogs(prev => prev + `[执行] ffmpeg ${args.join(' ')}\n`);
      
      const ret = await ffmpeg.exec(args);
      
      if (ret !== 0) {
        throw new Error(`转换中止 (代码 ${ret})。通常是因为源视频包含的音频/字幕轨道无法在开启“无损模式”下被直接封装为 ${formData.format}。请关闭无损模式重试。详情见日志。`);
      }
      
      setLogs(prev => prev + `[系统] 处理完成，正在从内存打包导出...\n`);
      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([data.buffer], { type: `video/${outputExt}` }));
      
      setResultData({ url, filename: outputName });
    } catch (err) {
      console.error(err);
      const msg = typeof err === 'string'
        ? err
        : (err && typeof err === 'object' && 'message' in err ? err.message : String(err));
      setErrorMsg(msg || "处理发生未知异常");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Keshi Studio</h1>
              <p className="text-[10px] text-gray-400 font-mono tracking-widest">芥子 · 芥子纳须弥，一念转流光</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${engineStatus === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-xs font-medium text-gray-500">{engineStatus === 'ready' ? '本地算力就绪' : '算力待命'}</span>
          </div>
        </div>

        <div className="relative group">
          <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            className="w-full bg-white border border-gray-200 py-5 pl-12 pr-32 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 transition-all text-lg shadow-sm"
            placeholder="告诉我想怎么处理视频..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyzeIntent()}
          />
          <button 
            onClick={analyzeIntent}
            disabled={isAnalyzing || !prompt.trim()}
            className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-xl font-medium disabled:opacity-30 active:scale-95 transition-all shadow-md shadow-blue-100"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AI 解析'}
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-5 rounded-2xl flex flex-col gap-2 animate-in shake duration-300">
            <p className="font-bold text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> 引擎反馈</p>
            <p className="text-xs opacity-80 leading-relaxed font-mono">{errorMsg}</p>
          </div>
        )}

        <DynamicForm 
          schema={schema} 
          formData={formData} 
          onChange={(k, v) => setFormData(prev => ({...prev, [k]: v}))}
          onSubmit={handleProcess}
          isProcessing={isProcessing}
          progress={progress}
          logs={logs}
          logEndRef={logEndRef}
          isElectron={isElectron}
        />

        {resultData && (
          <div className="bg-gray-900 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-500 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <span className="text-white text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" /> 处理圆满完成
              </span>
              <a href={resultData.url} download={resultData.filename} className="bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 shadow-xl">
                <Download className="w-4 h-4" /> 导出结果
              </a>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-inner ring-1 ring-white/10">
              <video src={resultData.url} controls className="w-full bg-black max-h-[500px]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}