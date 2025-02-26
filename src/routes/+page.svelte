<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  
  let youtubeUrl = '';
  let fileUrl = '';
  let error = '';
  let isLoading = false;
  let isInfoLoading = false;
  let videoInfo = null;
  let inputFocused = false;
  let downloadComplete = false;
  let showCopiedMessage = false;
  let downloadProgress = 0;
  let downloadProgressInterval;
  
  // Format and quality options
  let selectedFormat = 'mp3';
  let selectedQuality = '128K';
  let selectedFormatId = null;
  
  // Audio quality options with improved descriptions
  const audioQualities = [
    { value: '64K', label: '64 kbps', description: 'Menor tamanho, qualidade básica' },
    { value: '128K', label: '128 kbps', description: 'Boa qualidade, tamanho moderado' },
    { value: '192K', label: '192 kbps', description: 'Qualidade alta, recomendado' },
    { value: '256K', label: '256 kbps', description: 'Qualidade muito alta' },
    { value: '320K', label: '320 kbps', description: 'Qualidade máxima, maior tamanho' }
  ];
  
  // Demo mode for quick UI testing - comment out in production
  /*
  onMount(() => {
    // Simulate having a video for testing UI
    videoInfo = {
      title: "Never Gonna Give You Up - Rick Astley (Official Music Video)",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      duration: 213,
      audioFormats: [
        { formatId: "251", ext: "webm", audioBitrate: 160, filesize: 3541234, isAudioOnly: true },
        { formatId: "140", ext: "m4a", audioBitrate: 128, filesize: 3245621, isAudioOnly: true }
      ],
      videoFormats: [
        { formatId: "22", ext: "mp4", resolution: "720p", filesize: 19876543, isAudioOnly: false },
        { formatId: "18", ext: "mp4", resolution: "360p", filesize: 9876543, isAudioOnly: false }
      ]
    };
  });
  */
  
  // Check if URL is a valid YouTube URL
  function isValidYouTubeUrl(url) {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return ytRegex.test(url);
  }
  
  // Reset all states
  function resetStates() {
    fileUrl = '';
    error = '';
    downloadComplete = false;
    clearInterval(downloadProgressInterval);
    downloadProgress = 0;
  }
  
  // Get video information
  async function getVideoInfo() {
    if (!youtubeUrl) {
      showError('Por favor, insira um URL do YouTube');
      return;
    }
    
    if (!isValidYouTubeUrl(youtubeUrl)) {
      showError('URL inválido. Por favor, insira um link do YouTube válido');
      return;
    }
    
    resetStates();
    isInfoLoading = true;
    
    try {
      const response = await fetch(`/api/convert?url=${encodeURIComponent(youtubeUrl)}`);
      
      if (!response.ok) {
        throw new Error('Falha ao obter informações do vídeo');
      }
      
      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
      } else {
        videoInfo = data;
        
        // Group formats by type
        videoInfo.audioFormats = data.formats.filter(f => f.isAudioOnly);
        videoInfo.videoFormats = data.formats.filter(f => !f.isAudioOnly && f.ext === 'mp4')
          .sort((a, b) => {
            // Extract resolution height numbers for comparison
            const getHeight = (res) => {
              const match = res.match(/\d+/);
              return match ? parseInt(match[0]) : 0;
            };
            return getHeight(b.resolution) - getHeight(a.resolution);
          });
      }
    } catch (err) {
      showError('Erro ao obter informações do vídeo. Tente novamente.');
    } finally {
      isInfoLoading = false;
    }
  }
  
  // Convert video
  async function convertVideo() {
    if (!youtubeUrl) {
      showError('Por favor, insira um URL do YouTube');
      return;
    }
    
    if (!videoInfo) {
      await getVideoInfo();
      if (!videoInfo) return; // If we still don't have video info, stop
    }
    
    isLoading = true;
    error = '';
    fileUrl = '';
    
    // Begin simulated progress
    startProgressSimulation();
    
    // Prepare request body based on selection
    const requestBody = {
      url: youtubeUrl,
      outputFormat: selectedFormat
    };
    
    // Add specific format if selected
    if (selectedFormatId) {
      requestBody.format = selectedFormatId;
    } else if (selectedFormat === 'mp3') {
      // Add quality for MP3
      requestBody.quality = selectedQuality;
    }
    
    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
      } else {
        fileUrl = data.fileUrl;
        downloadComplete = true;
        downloadProgress = 100;
      }
    } catch (err) {
      showError('Erro ao converter o vídeo. Tente novamente.');
    } finally {
      isLoading = false;
      clearInterval(downloadProgressInterval);
    }
  }
  
  // Simulate download progress
  function startProgressSimulation() {
    downloadProgress = 0;
    clearInterval(downloadProgressInterval);
    
    downloadProgressInterval = setInterval(() => {
      // Realistic progress simulation
      if (downloadProgress < 90) {
        // Progress slows down as it approaches 90%
        const increment = Math.max(0.5, (95 - downloadProgress) / 10);
        downloadProgress += increment;
      }
      
      if (downloadComplete) {
        downloadProgress = 100;
        clearInterval(downloadProgressInterval);
      }
    }, 300);
  }
  
  // Show error with auto-dismissal
  function showError(message) {
    error = message;
    setTimeout(() => {
      error = '';
    }, 5000);
  }
  
  // Watch for URL changes to reset the state
  function handleUrlChange() {
    if (videoInfo) resetStates();
  }
  
  // Handle paste from clipboard
  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidYouTubeUrl(text)) {
        youtubeUrl = text;
        getVideoInfo();
      }
    } catch (err) {
      // Clipboard access might be denied
      console.log('Clipboard access denied');
    }
  }
  
  // Copy download link to clipboard
  async function copyDownloadLink() {
    if (fileUrl) {
      try {
        const absoluteUrl = new URL(fileUrl, window.location.origin).href;
        await navigator.clipboard.writeText(absoluteUrl);
        showCopiedMessage = true;
        setTimeout(() => {
          showCopiedMessage = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }
  }
  
  // Format change handler
  function handleFormatChange() {
    selectedFormatId = null; // Reset format ID when changing output format
  }
  
  // Format file size display
  function formatFileSize(bytes) {
    if (!bytes) return 'Tamanho desconhecido';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  // Format duration display
  function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>YTDownloader • Baixe vídeos e áudios do YouTube</title>
  <meta name="description" content="Baixe vídeos e áudios do YouTube com máxima qualidade e conversão rápida" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col">
  <!-- Header Section -->
  <header class="py-4 px-6 bg-white shadow-sm">
    <div class="max-w-6xl mx-auto flex justify-between items-center">
      <div class="flex items-center space-x-2">
        <span class="text-red-600 text-2xl"><i class="fas fa-play-circle"></i></span>
        <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">YTDownloader</h1>
      </div>
      <nav class="hidden md:flex space-x-6">
        <a href="#" class="text-gray-600 hover:text-blue-600 transition-colors">Início</a>
        <a href="#" class="text-gray-600 hover:text-blue-600 transition-colors">Como Funciona</a>
        <a href="#" class="text-gray-600 hover:text-blue-600 transition-colors">FAQ</a>
      </nav>
    </div>
  </header>

  <main class="flex-grow flex items-center justify-center p-4">
    <div class="w-full max-w-4xl">
      <!-- Hero Section -->
      {#if !videoInfo}
        <div in:fade={{ duration: 300 }} class="text-center mb-8">
          <h2 class="text-4xl font-bold text-gray-800 mb-4">Baixe vídeos do YouTube</h2>
          <p class="text-xl text-gray-600 mb-8">Rápido, gratuito e de alta qualidade</p>
        </div>
      {/if}
      
      <!-- Main Card -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 transform hover:shadow-xl">
        <!-- URL Input Section -->
        <div class="p-6 bg-gradient-to-r from-blue-500 to-indigo-600">
          <div class="relative">
            <div class={`flex rounded-lg overflow-hidden border-2 transition-all ${inputFocused ? 'border-white' : 'border-blue-300'} ${error ? 'border-red-400' : ''}`}>
              <input
                type="text"
                bind:value={youtubeUrl}
                on:input={handleUrlChange}
                on:focus={() => inputFocused = true}
                on:blur={() => inputFocused = false}
                placeholder="Cole o link do YouTube aqui"
                class="w-full p-4 pr-12 text-gray-800 bg-white outline-none placeholder-gray-400"
              />
              <div class="flex">
                {#if youtubeUrl}
                  <button 
                    on:click={() => { youtubeUrl = ''; resetStates(); videoInfo = null; }}
                    class="p-4 bg-white text-gray-400 hover:text-gray-600 transition-colors"
                    title="Limpar"
                  >
                    <i class="fas fa-times"></i>
                  </button>
                {/if}
                <button 
                  on:click={handlePaste}
                  class="p-4 bg-white text-gray-400 hover:text-gray-600 transition-colors"
                  title="Colar da área de transferência"
                >
                  <i class="fas fa-paste"></i>
                </button>
                <button
                  on:click={getVideoInfo}
                  disabled={isInfoLoading || !youtubeUrl}
                  class="p-4 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed w-32"
                >
                  {#if isInfoLoading}
                    <div class="flex items-center justify-center">
                      <div class="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Carregando</span>
                    </div>
                  {:else}
                    <span>Analisar</span>
                  {/if}
                </button>
              </div>
            </div>
            
            {#if error}
              <div in:fly={{ y: 10, duration: 200 }} out:fade class="absolute -bottom-8 left-0 text-red-200 text-sm flex items-center">
                <i class="fas fa-exclamation-circle mr-2"></i>
                <span>{error}</span>
              </div>
            {/if}
          </div>
        </div>
        
        {#if videoInfo}
          <div in:fade={{ duration: 300 }} class="p-6">
            <!-- Video Info Display -->
            <div class="flex flex-col md:flex-row gap-4 mb-6 border-b border-gray-100 pb-6">
              {#if videoInfo.thumbnail}
                <div class="w-full md:w-48 flex-shrink-0 rounded-lg overflow-hidden shadow-md">
                  <img 
                    src={videoInfo.thumbnail} 
                    alt="Thumbnail" 
                    class="w-full h-full object-cover"
                  />
                </div>
              {/if}
              <div class="flex-1">
                <h2 class="font-bold text-xl text-gray-800 mb-2">{videoInfo.title}</h2>
                {#if videoInfo.duration}
                  <div class="flex items-center text-gray-600 mb-2">
                    <i class="far fa-clock mr-2"></i>
                    <span>{formatDuration(videoInfo.duration)}</span>
                  </div>
                {/if}
                <div class="mt-4 flex flex-wrap gap-2">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <i class="fas fa-video mr-1"></i> YouTube
                  </span>
                  {#if videoInfo.videoFormats?.length}
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <i class="fas fa-film mr-1"></i> Vídeo disponível
                    </span>
                  {/if}
                  {#if videoInfo.audioFormats?.length}
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <i class="fas fa-music mr-1"></i> Áudio disponível
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            
            <!-- Format Selection -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">Opções de download</h3>
              
              <!-- Format Tabs -->
              <div class="flex border-b border-gray-200 mb-4">
                <button 
                  class={`py-2 px-4 font-medium text-sm ${selectedFormat === 'mp3' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  on:click={() => { selectedFormat = 'mp3'; handleFormatChange(); }}
                >
                  <i class="fas fa-music mr-2"></i> MP3 (Áudio)
                </button>
                <button 
                  class={`py-2 px-4 font-medium text-sm ${selectedFormat === 'mp4' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  on:click={() => { selectedFormat = 'mp4'; handleFormatChange(); }}
                >
                  <i class="fas fa-video mr-2"></i> MP4 (Vídeo)
                </button>
              </div>
              
              <!-- MP3 Options -->
              {#if selectedFormat === 'mp3'}
                <div in:fade={{ duration: 200 }}>
                  {#if !selectedFormatId}
                    <div class="mb-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Qualidade do Áudio</label>
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {#each audioQualities as quality}
                          <button 
                            class={`border rounded-lg p-3 transition-all ${selectedQuality === quality.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                            on:click={() => selectedQuality = quality.value}
                          >
                            <div class="font-medium">{quality.label}</div>
                            <div class="text-xs text-gray-500 mt-1">{quality.description}</div>
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  
                  {#if videoInfo.audioFormats?.length}
                    <div class="mt-6">
                      <div class="flex items-center justify-between mb-3">
                        <h4 class="text-sm font-medium text-gray-700">Formatos disponíveis</h4>
                        {#if selectedFormatId}
                          <button 
                            on:click={() => selectedFormatId = null}
                            class="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Voltar para MP3 padrão
                          </button>
                        {/if}
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {#each videoInfo.audioFormats as format}
                          {#if format.audioBitrate}
                            <button 
                              class={`flex justify-between items-center border rounded-lg p-3 transition-all ${selectedFormatId === format.formatId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                              on:click={() => selectedFormatId = format.formatId}
                            >
                              <div>
                                <div class="font-medium text-gray-800">
                                  {format.ext.toUpperCase()} - {format.audioBitrate}kbps
                                </div>
                                <div class="text-xs text-gray-500 mt-1">{formatFileSize(format.filesize)}</div>
                              </div>
                              <div class={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFormatId === format.formatId ? 'border-blue-500' : 'border-gray-300'}`}>
                                {#if selectedFormatId === format.formatId}
                                  <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                                {/if}
                              </div>
                            </button>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
              
              <!-- MP4 Options -->
              {#if selectedFormat === 'mp4' && videoInfo.videoFormats?.length}
                <div in:fade={{ duration: 200 }} class="mt-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-700">Qualidade do Vídeo</h4>
                    {#if selectedFormatId}
                      <button 
                        on:click={() => selectedFormatId = null}
                        class="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Usar qualidade automática
                      </button>
                    {/if}
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {#each videoInfo.videoFormats as format}
                      <button 
                        class={`border rounded-lg p-4 transition-all ${selectedFormatId === format.formatId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                        on:click={() => selectedFormatId = format.formatId}
                      >
                        <div class="flex justify-between items-center">
                          <div class="font-semibold text-gray-800">{format.resolution}</div>
                          <div class={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFormatId === format.formatId ? 'border-blue-500' : 'border-gray-300'}`}>
                            {#if selectedFormatId === format.formatId}
                              <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                            {/if}
                          </div>
                        </div>
                        <div class="flex items-center mt-2 text-gray-500 text-sm">
                          <i class="fas fa-file-video mr-2"></i>
                          <span>{formatFileSize(format.filesize)}</span>
                        </div>
                      </button>
                    {/each}
                    <button 
                      class={`border rounded-lg p-4 transition-all ${selectedFormatId === null ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      on:click={() => selectedFormatId = null}
                    >
                      <div class="flex justify-between items-center">
                        <div class="font-semibold text-gray-800">Melhor qualidade</div>
                        <div class={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFormatId === null ? 'border-blue-500' : 'border-gray-300'}`}>
                          {#if selectedFormatId === null}
                            <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                          {/if}
                        </div>
                      </div>
                      <div class="flex items-center mt-2 text-gray-500 text-sm">
                        <i class="fas fa-magic mr-2"></i>
                        <span>Recomendado</span>
                      </div>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
            
            <!-- Convert and Download Section -->
            <div>
              {#if !isLoading && !fileUrl}
                <button
                  on:click={convertVideo}
                  class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-medium text-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <i class="fas fa-download mr-2"></i> Baixar {selectedFormat.toUpperCase()}
                </button>
              {/if}
              
              {#if isLoading}
                <div in:fade={{ duration: 200 }} class="mt-4">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-medium text-gray-700">Processando download...</span>
                    <span class="text-sm text-gray-500">{Math.round(downloadProgress)}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={`width: ${downloadProgress}%`}
                    ></div>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">Por favor, aguarde enquanto processamos seu arquivo</p>
                </div>
              {/if}
              
              {#if fileUrl}
                <div in:scale={{ duration: 300, start: 0.95 }} class="mt-4 bg-green-50 border border-green-100 rounded-lg p-4">
                  <div class="flex items-center text-green-700 mb-3">
                    <i class="fas fa-check-circle text-lg mr-2"></i>
                    <span class="font-medium">Conversão concluída!</span>
                  </div>
                  
                  <div class="flex flex-col sm:flex-row gap-2">
                    <a
                      href={fileUrl}
                      download
                      class="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium text-center hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <i class="fas fa-download mr-2"></i> Baixar {selectedFormat.toUpperCase()}
                    </a>
                    
                    <button
                      on:click={copyDownloadLink}
                      class="sm:flex-none bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors relative"
                    >
                      {#if showCopiedMessage}
                        <span in:scale={{ duration: 200, start: 0.8 }} class="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded">
                          Copiado!
                        </span>
                      {/if}
                      <i class="fas fa-link mr-2"></i> Copiar Link
                    </button>
                    
                    <button
                      on:click={() => { resetStates(); videoInfo = null; }}
                      class="sm:flex-none bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      <i class="fas fa-redo mr-2"></i> Novo
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Features Section -->
      {#if !videoInfo}
        <div in:fade={{ duration: 300, delay: 200 }} class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div class="bg-white p-5 rounded-xl shadow-sm">
            <div class="text-blue-500 text-2xl mb-3">
              <i class="fas fa-bolt"></i>
            </div>
            <h3 class="font-bold text-lg mb-2">Rápido e Fácil</h3>
            <p class="text-gray-600">Basta colar o link e escolher o formato desejado para iniciar o download.</p>
          </div>
          
          <div class="bg-white p-5 rounded-xl shadow-sm">
            <div class="text-blue-500 text-2xl mb-3">
              <i class="fas fa-check-circle"></i>
            </div>
            <h3 class="font-bold text-lg mb-2">Alta Qualidade</h3>
            <p class="text-gray-600">Baixe vídeos em até 4K e áudios em qualidade de até 320kbps.</p>
          </div>
          
          <div class="bg-white p-5 rounded-xl shadow-sm">
            <div class="text-blue-500 text-2xl mb-3">
              <i class="fas fa-lock"></i>
            </div>
            <h3 class="font-bold text-lg mb-2">Seguro e Privado</h3>
            <p class="text-gray-600">Não armazenamos seus vídeos ou informações pessoais em nossos servidores.</p>
          </div>
        </div>
      {/if}
    </div>
  </main>
  
  <!-- Footer -->
  <footer class="bg-white py-6 px-6 shadow-inner mt-auto">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col md:flex-row md:justify-between items-center">
        <div class="mb-4 md:mb-0">
          <div class="flex items-center space-x-2">
            <span class="text-red-600 text-xl"><i class="fas fa-play-circle"></i></span>
            <h1 class="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">YTDownloader</h1>
          </div>
          <p class="text-sm text-gray-500 mt-1">Baixe vídeos e músicas do YouTube</p>
        </div>
        
        <div class="flex space-x-6">
          <a href="#" class="text-gray-500 hover:text-blue-600 transition-colors">
            <i class="fab fa-twitter"></i>
          </a>
          <a href="#" class="text-gray-500 hover:text-blue-600 transition-colors">
            <i class="fab fa-facebook"></i>
          </a>
          <a href="#" class="text-gray-500 hover:text-blue-600 transition-colors">
            <i class="fab fa-instagram"></i>
          </a>
        </div>
      </div>
      
      <div class="border-t border-gray-100 mt-6 pt-6 flex flex-col md:flex-row md:justify-between">
        <div class="text-sm text-gray-500 mb-4 md:mb-0">
          © {new Date().getFullYear()} YTDownloader. Todos os direitos reservados.
        </div>
        
        <div class="flex flex-wrap gap-4">
          <a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Termos de Uso</a>
          <a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Política de Privacidade</a>
          <a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Contato</a>
        </div>
      </div>
    </div>
  </footer>

  </div>  