import React, { useState, useCallback } from 'react';
import { ChaosParams, AppMode, CustomKey } from './types';
import MatrixButton from './components/MatrixButton';
import * as chaosEngine from './services/chaosEngine';
import { Lock, Unlock, Shield, Copy, AlertCircle, CheckCircle, Key } from 'lucide-react';

const DEFAULT_PARAMS: ChaosParams = {
  sigma: 10.0,
  rho: 28.0,
  beta: 2.667,
  startX: 1.0,
  startY: 1.0,
  startZ: 1.0,
  iterations: 0
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.ENCODE);
  const [params, setParams] = useState<ChaosParams>(DEFAULT_PARAMS);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [customKey, setCustomKey] = useState<CustomKey | null>(null);
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  const generateNewCustomKey = useCallback(() => {
    const newKey = chaosEngine.generateCustomKey();
    setCustomKey(newKey);
    setSuccess('Custom key generated successfully');
  }, []);

  const copyKeyToClipboard = useCallback(() => {
    if (customKey) {
      const serialized = chaosEngine.serializeCustomKey(customKey);
      navigator.clipboard.writeText(serialized).then(() => {
        setSuccess('Custom key copied to clipboard');
        setTimeout(() => setSuccess(''), 2000);
      });
    }
  }, [customKey]);

  const importCustomKey = useCallback(() => {
    try {
      clearMessages();
      if (!keyInput.trim()) {
        setError('Please paste a custom key');
        return;
      }
      const imported = chaosEngine.deserializeCustomKey(keyInput.trim());
      setCustomKey(imported);
      setKeyInput('');
      setSuccess('Custom key imported successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import custom key');
    }
  }, [keyInput, clearMessages]);

  const handleEncrypt = useCallback(async () => {
    clearMessages();
    if (!inputText.trim()) {
      setError('Please enter a message to encrypt');
      return;
    }
    
    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const encrypted = chaosEngine.encryptMessage(inputText, params, useCustomKey ? customKey || undefined : undefined);
      setOutputText(encrypted);
      setSuccess('Message encrypted successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encryption failed');
      setOutputText('');
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, params, useCustomKey, customKey, clearMessages]);

  const handleDecrypt = useCallback(() => {
    clearMessages();
    if (!inputText.trim()) {
      setError('Please enter an encrypted blob to decrypt');
      return;
    }

    setIsProcessing(true);
    try {
      setTimeout(() => {
        try {
          const result = chaosEngine.decryptMessage(inputText, useCustomKey ? customKey || undefined : undefined);
          setOutputText(result.message);
          setParams(result.params);
          setSuccess('Message decrypted successfully');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Decryption failed');
          setOutputText('');
        } finally {
          setIsProcessing(false);
        }
      }, 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decryption failed');
      setIsProcessing(false);
    }
  }, [inputText, useCustomKey, customKey, clearMessages]);

  const copyToClipboard = useCallback(() => {
    if (outputText) {
      navigator.clipboard.writeText(outputText).then(() => {
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
      });
    }
  }, [outputText]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-mono p-4 md:p-6 flex flex-col items-center">
      
      <header className="w-full max-w-2xl mb-6 border-b border-neutral-300 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Shield className="text-black" size={20} />
            <h1 className="text-lg font-bold uppercase tracking-tight">V-X9 CRYPT</h1>
          </div>
          <button
            onClick={() => setShowKeySettings(!showKeySettings)}
            className="p-2 hover:bg-neutral-200 rounded transition-colors"
            title="Key Settings"
          >
            <Key size={18} />
          </button>
        </div>
        <p className="text-xs text-neutral-500 uppercase tracking-widest">Uncrackable Encryption System</p>
      </header>

      {showKeySettings && (
        <div className="w-full max-w-2xl mb-6 bg-white border border-neutral-300 rounded p-4">
          <h2 className="text-sm font-bold uppercase mb-2 flex items-center gap-2">
            <Key size={16} /> Custom Key Management
          </h2>
          <p className="text-xs text-neutral-600 mb-4">
            Custom keys add an extra layer of security. Recipients need both this website AND your custom key to decrypt.
          </p>
          
          <div className="space-y-4">
            <div className="border border-neutral-200 rounded p-3 bg-neutral-50">
              <label className="text-xs font-bold text-neutral-700 uppercase mb-2 block">Step 1: Generate New Key</label>
              <p className="text-xs text-neutral-600 mb-2">Create a random 256-byte encryption key (2048 bits)</p>
              <button
                onClick={generateNewCustomKey}
                className="w-full py-2 px-3 bg-neutral-800 text-white text-xs font-bold uppercase hover:bg-neutral-900 transition-colors rounded"
              >
                Generate 256-Byte Custom Key
              </button>
              {customKey && (
                <>
                  <div className="mt-2 p-2 bg-white border border-neutral-300 rounded text-xs break-all font-mono max-h-20 overflow-y-auto">
                    {chaosEngine.serializeCustomKey(customKey).substring(0, 120)}...
                  </div>
                  <button
                    onClick={copyKeyToClipboard}
                    className="mt-2 w-full py-2 px-3 bg-blue-600 text-white text-xs font-bold uppercase hover:bg-blue-700 transition-colors rounded flex items-center justify-center gap-2"
                  >
                    <Copy size={12} /> Copy Full Key (Share Securely)
                  </button>
                </>
              )}
            </div>

            <div className="border border-neutral-200 rounded p-3 bg-neutral-50">
              <label className="text-xs font-bold text-neutral-700 uppercase mb-2 block">Step 2: Import Existing Key (Optional)</label>
              <p className="text-xs text-neutral-600 mb-2">Paste a custom key someone shared with you to decrypt their messages</p>
              <textarea
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste custom key here (Base64 format)..."
                className="w-full h-20 bg-white border border-neutral-300 p-2 text-xs font-mono focus:border-black focus:outline-none transition-colors resize-none"
              />
              <button
                onClick={importCustomKey}
                className="mt-2 w-full py-2 px-3 bg-neutral-800 text-white text-xs font-bold uppercase hover:bg-neutral-900 transition-colors rounded"
              >
                Import Key
              </button>
            </div>

            <div className="border border-neutral-200 rounded p-3 bg-blue-50 border-blue-300">
              <label className="text-xs font-bold text-neutral-700 uppercase mb-2 block">Step 3: Enable Custom Key</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomKey}
                  onChange={(e) => setUseCustomKey(e.target.checked)}
                  disabled={!customKey}
                  className="w-4 h-4"
                />
                <span className="text-xs font-bold text-neutral-800">
                  {customKey ? '✓ Use this custom key for encrypt/decrypt operations' : '⚠️ Generate or import a key first'}
                </span>
              </label>
              {useCustomKey && (
                <p className="text-xs text-blue-700 mt-2 font-mono">
                  🔐 Custom key mode active - Recipients will need your key + this website to decrypt
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-2xl">
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button 
            onClick={() => { 
              setMode(AppMode.ENCODE); 
              setInputText(''); 
              setOutputText('');
              clearMessages();
            }}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wide transition-all border rounded ${
              mode === AppMode.ENCODE 
                ? 'bg-black text-white border-black shadow-sm' 
                : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <Lock size={14} className="inline mr-2" /> Encrypt
          </button>
          <button 
            onClick={() => { 
              setMode(AppMode.DECODE); 
              setInputText(''); 
              setOutputText('');
              clearMessages();
            }}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wide transition-all border rounded ${
              mode === AppMode.DECODE 
                ? 'bg-black text-white border-black shadow-sm' 
                : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <Unlock size={14} className="inline mr-2" /> Decrypt
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-3">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded flex items-start gap-3">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700">{success}</p>
          </div>
        )}

        <div className="bg-white border border-neutral-300 rounded shadow-sm overflow-hidden">
          
          <div className="p-4 border-b border-neutral-300">
            <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
              {mode === AppMode.ENCODE ? 'Message' : 'Encrypted Blob'}
            </label>
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                clearMessages();
              }}
              placeholder={mode === AppMode.ENCODE ? 'Enter your secret message...' : 'Paste encrypted data...'}
              className="w-full h-32 bg-neutral-50 border border-neutral-200 p-3 text-xs font-mono focus:border-black focus:bg-white focus:outline-none transition-colors resize-none"
            />
          </div>

          {outputText && (
            <div className="p-4 border-t border-neutral-300 bg-neutral-50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
                  Output
                </label>
                <button
                  onClick={copyToClipboard}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase flex items-center gap-1 transition-colors"
                >
                  <Copy size={12} />
                  {copiedToClipboard ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-white border border-neutral-200 p-3 rounded text-xs font-mono text-neutral-800 break-all max-h-40 overflow-y-auto">
                {outputText}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-neutral-300 bg-neutral-50 flex gap-3">
            {mode === AppMode.ENCODE ? (
              <MatrixButton 
                onClick={handleEncrypt} 
                disabled={isProcessing || !inputText.trim()}
                className="flex-1 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400 py-2.5 text-xs"
              >
                {isProcessing ? 'Encrypting...' : 'Encrypt'} <Lock size={13} className="inline ml-2" />
              </MatrixButton>
            ) : (
              <MatrixButton 
                onClick={handleDecrypt} 
                disabled={isProcessing || !inputText.trim()}
                className="flex-1 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400 py-2.5 text-xs"
              >
                {isProcessing ? 'Decrypting...' : 'Decrypt'} <Unlock size={13} className="inline ml-2" />
              </MatrixButton>
            )}
          </div>
        </div>

      </main>

      <footer className="mt-8 text-center text-[10px] text-neutral-400 uppercase font-bold tracking-widest">
        {useCustomKey ? '🔐 Custom Key Mode' : 'Default Mode'} • Uncrackable • Open Source
      </footer>
    </div>
  );
};

export default App;
