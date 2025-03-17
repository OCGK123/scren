<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>화면 공유 뷰어</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .header {
            background-color: #333;
            color: white;
            padding: 15px;
            text-align: center;
        }
        .connection-panel {
            background-color: white;
            margin: 20px auto;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            width: 90%;
            max-width: 500px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .button-group {
            display: flex;
            gap: 10px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            flex: 1;
        }
        button:hover {
            background-color: #45a049;
        }
        button.secondary {
            background-color: #555;
        }
        button.secondary:hover {
            background-color: #444;
        }
        .status-bar {
            background-color: #f0f0f0;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status {
            font-weight: bold;
        }
        .status.connected {
            color: #4CAF50;
        }
        .status.connecting {
            color: #ff9800;
        }
        .status.disconnected {
            color: #f44336;
        }
        .quality-control {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .screen-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            background-color: #000;
            overflow: hidden;
        }
        video {
            max-width: 100%;
            max-height: 100%;
            background-color: #111;
        }
        .hidden {
            display: none;
        }
        .stats {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
        }
        
        .controls {
            background-color: #333;
            padding: 10px;
            display: flex;
            justify-content: center;
            gap: 15px;
        }
        .control-button {
            background-color: #555;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
        }
        .control-button:hover {
            background-color: #777;
        }
        .fullscreen {
            flex: 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>화면 공유 뷰어</h1>
    </div>
    
    <div class="connection-panel" id="connectionPanel">
        <div class="form-group">
            <label for="connectionCode">연결 코드 입력:</label>
            <input type="text" id="connectionCode" placeholder="클라이언트에서 제공한 연결 코드를 입력하세요">
        </div>
        <div class="form-group">
            <label for="viewerId">내 P2P ID:</label>
            <input type="text" id="viewerId" placeholder="고유 ID를 입력하세요 (예: 임의의 문자열)">
        </div>
        <div class="button-group">
            <button id="connectBtn">연결하기</button>
            <button id="generateIdBtn" class="secondary">ID 생성</button>
        </div>
        <div class="status-bar hidden" id="statusBar">
            <div class="status disconnected" id="connectionStatus">연결 상태: 연결 끊김</div>
            <div class="quality-control">
                <label for="qualitySelect">화질:</label>
                <select id="qualitySelect">
                    <option value="high">고화질</option>
                    <option value="medium" selected>중화질</option>
                    <option value="low">저화질</option>
                    <option value="minimal">최소화질</option>
                </select>
            </div>
        </div>
    </div>
    
    <div class="screen-container hidden" id="screenContainer">
        <video id="remoteVideo" autoplay playsinline></video>
    </div>
    
    <div class="controls hidden" id="controls">
        <button class="control-button" id="refreshBtn">화면 새로고침</button>
        <button class="control-button" id="fullscreenBtn">전체화면</button>
        <button class="control-button" id="disconnectBtn">연결 끊기</button>
    </div>
    
    <div class="stats hidden" id="stats">
        <div>해상도: <span id="resolution">-</span></div>
        <div>프레임레이트: <span id="framerate">-</span> fps</div>
        <div>비트레이트: <span id="bitrate">-</span> kbps</div>
        <div>지연시간: <span id="latency">-</span> ms</div>
    </div>

    <script>
        // WebRTC 설정
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };

        let peerConnection = null;
        let dataChannel = null;
        let isConnected = false;
        let statsInterval = null;
        let latencyCheckInterval = null;
        let lastPingTime = 0;

        // DOM 요소
        const connectBtn = document.getElementById('connectBtn');
        const generateIdBtn = document.getElementById('generateIdBtn');
        const connectionCodeInput = document.getElementById('connectionCode');
        const viewerIdInput = document.getElementById('viewerId');
        const connectionPanel = document.getElementById('connectionPanel');
        const statusBar = document.getElementById('statusBar');
        const connectionStatus = document.getElementById('connectionStatus');
        const screenContainer = document.getElementById('screenContainer');
        const remoteVideo = document.getElementById('remoteVideo');
        const controls = document.getElementById('controls');
        const refreshBtn = document.getElementById('refreshBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const qualitySelect = document.getElementById('qualitySelect');
        const stats = document.getElementById('stats');
        const resolutionSpan = document.getElementById('resolution');
        const framerateSpan = document.getElementById('framerate');
        const bitrateSpan = document.getElementById('bitrate');
        const latencySpan = document.getElementById('latency');

        // 랜덤 ID 생성
        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // ID 생성 버튼 이벤트
        generateIdBtn.addEventListener('click', () => {
            viewerIdInput.value = generateUUID();
        });

        // 초기 ID 설정
        if (!viewerIdInput.value) {
            viewerIdInput.value = generateUUID();
        }

        // 연결 시작
        async function startConnection() {
            try {
                const connectionCode = connectionCodeInput.value.trim();
                const viewerId = viewerIdInput.value.trim();
                
                if (!connectionCode) {
                    alert('연결 코드를 입력해주세요.');
                    return false;
                }
                
                if (!viewerId) {
                    alert('P2P ID를 입력해주세요.');
                    return false;
                }
                
                // 이전 연결 정리
                if (peerConnection) {
                    peerConnection.close();
                }
                
                // 연결 상태 업데이트
                updateConnectionStatus('connecting');
                statusBar.classList.remove('hidden');
                
                try {
                    // 연결 코드 디코딩
                    const offerData = JSON.parse(atob(connectionCode));
                    
                    if (offerData.type !== 'offer' || !offerData.sdp) {
                        throw new Error('유효하지 않은 연결 코드입니다.');
                    }
                    
                    // 새 연결 생성
                    peerConnection = new RTCPeerConnection(configuration);
                    
                    // 데이터 채널 이벤트 처리
                    peerConnection.ondatachannel = (event) => {
                        dataChannel = event.channel;
                        setupDataChannel(dataChannel);
                    };
                    
                    // 트랙 이벤트 처리
                    peerConnection.ontrack = (event) => {
                        if (remoteVideo.srcObject !== event.streams[0]) {
                            console.log('원격 스트림 수신');
                            remoteVideo.srcObject = event.streams[0];
                            
                            // UI 업데이트
                            screenContainer.classList.remove('hidden');
                            controls.classList.remove('hidden');
                            stats.classList.remove('hidden');
                        }
                    };
                    
                    // ICE 후보 수집 이벤트 처리
                    const iceCandidates = [];
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            iceCandidates.push(event.candidate);
                        }
                    };
                    
                    // 연결 상태 변화 감지
                    peerConnection.onconnectionstatechange = () => {
                        console.log('연결 상태 변경:', peerConnection.connectionState);
                        updateConnectionStatus(peerConnection.connectionState);
                        
                        if (peerConnection.connectionState === 'connected') {
                            isConnected = true;
                            startStats();
                            startLatencyCheck();
                        } else if (peerConnection.connectionState === 'disconnected' || 
                                  peerConnection.connectionState === 'failed' ||
                                  peerConnection.connectionState === 'closed') {
                            isConnected = false;
                            stopStats();
                            stopLatencyCheck();
                        }
                    };
                    
                    // 원격 설명 설정
                    const remoteDesc = new RTCSessionDescription(offerData.sdp);
                    await peerConnection.setRemoteDescription(remoteDesc);
                    
                    // ICE 후보 추가
                    if (offerData.iceCandidates && Array.isArray(offerData.iceCandidates)) {
                        for (const candidate of offerData.iceCandidates) {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                    }
                    
                    // 응답 생성
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    // ICE 완료 대기
                    await new Promise(resolve => {
                        if (peerConnection.iceGatheringState === 'complete') {
                            resolve();
                        } else {
                            const checkState = () => {
                                if (peerConnection.iceGatheringState === 'complete') {
                                    peerConnection.removeEventListener('icegatheringstatechange', checkState);
                                    resolve();
                                }
                            };
                            peerConnection.addEventListener('icegatheringstatechange', checkState);
                            
                            // 타임아웃 설정
                            setTimeout(resolve, 5000);
                        }
                    });
                    
                    // 응답 데이터 생성
                    const answerData = {
                        type: 'answer',
                        sdp: peerConnection.localDescription,
                        viewerId: viewerId,
                        timestamp: Date.now(),
                        iceCandidates: iceCandidates
                    };
                    
                    // 응답 코드 생성
                    const answerCode = btoa(JSON.stringify(answerData));
                    
                    // 클립보드에 복사
                    await navigator.clipboard.writeText(answerCode);
                    alert('응답 코드가 클립보드에 복사되었습니다. 이 코드를 클라이언트에게 전달하세요.');
                    
                    return true;
                } catch (err) {
                    console.error('연결 설정 중 오류 발생:', err);
                    alert('연결 설정에 실패했습니다: ' + err.message);
                    updateConnectionStatus('disconnected');
                    return false;
                }
            } catch (err) {
                console.error('연결 설정 중 오류 발생:', err);
                alert('연결 설정에 실패했습니다.');
                return false;
            }
        }

        // 데이터 채널 설정
        function setupDataChannel(channel) {
            channel.onopen = () => {
                console.log('데이터 채널이 열렸습니다.');
                // 연결 완료 메시지 전송
                sendControlMessage({ type: 'connected', timestamp: Date.now() });
            };
            
            channel.onclose = () => {
                console.log('데이터 채널이 닫혔습니다.');
            };
            
            channel.onerror = (error) => {
                console.error('데이터 채널 오류:', error);
            };
            
            channel.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleControlMessage(message);
                } catch (err) {
                    console.error('메시지 처리 중 오류 발생:', err);
                }
            };
        }

        // 제어 메시지 처리
        function handleControlMessage(message) {
            console.log('제어 메시지 수신:', message);
            
            switch (message.type) {
                case 'status':
                    // 연결 상태 업데이트
                    if (!message.screenActive) {
                        // 화면 공유가 활성화되지 않은 경우
                        sendControlMessage({ type: 'restart' });
                    }
                    break;
                    
                case 'pong':
                    // 지연시간 계산
                    if (lastPingTime > 0) {
                        const latency = Date.now() - lastPingTime;
                        latencySpan.textContent = latency;
                        lastPingTime = 0;
                    }
                    break;
            }
        }

        // 제어 메시지 전송
        function sendControlMessage(message) {
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify(message));
            }
        }

        // 연결 상태 업데이트
        function updateConnectionStatus(state) {
            switch (state) {
                case 'new':
                case 'checking':
                case 'connecting':
                    connectionStatus.textContent = '연결 상태: 연결 중...';
                    connectionStatus.className = 'status connecting';
                    break;
                    
                case 'connected':
                    connectionStatus.textContent = '연결 상태: 연결됨';
                    connectionStatus.className = 'status connected';
                    break;
                    
                case 'disconnected':
                    connectionStatus.textContent = '연결 상태: 연결 끊김';
                    connectionStatus.className = 'status disconnected';
                    break;
                    
                case 'failed':
                    connectionStatus.textContent = '연결 상태: 연결 실패';
                    connectionStatus.className = 'status disconnected';
                    break;
                    
                case 'closed':
                    connectionStatus.textContent = '연결 상태: 연결 종료됨';
                    connectionStatus.className = 'status disconnected';
                    
                    // UI 업데이트
                    screenContainer.classList.add('hidden');
                    controls.classList.add('hidden');
                    stats.classList.add('hidden');
                    break;
            }
        }

        // 통계 모니터링 시작
        function startStats() {
            stopStats();
            
            statsInterval = setInterval(async () => {
                if (!peerConnection) return;
                
                try {
                    const stats = await peerConnection.getStats();
                    processStats(stats);
                } catch (err) {
                    console.error('통계 수집 중 오류 발생:', err);
                }
            }, 1000);
        }

        // 통계 모니터링 중지
        function stopStats() {
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
        }

        // 통계 처리
        function processStats(stats) {
            let frameWidth = 0;
            let frameHeight = 0;
            let framesPerSecond = 0;
            let bytesReceived = 0;
            let timestamp = 0;
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    bytesReceived = report.bytesReceived;
                    timestamp = report.timestamp;
                    framesPerSecond = report.framesPerSecond;
                    
                    if (report.frameWidth && report.frameHeight) {
                        frameWidth = report.frameWidth;
                        frameHeight = report.frameHeight;
                    }
                }
            });
            
            // 통계 업데이트
            if (frameWidth > 0 && frameHeight > 0) {
                resolutionSpan.textContent = `${frameWidth}x${frameHeight}`;
            }
            
            if (framesPerSecond > 0) {
                framerateSpan.textContent = framesPerSecond.toFixed(1);
            }
            
            if (bytesReceived > 0 && timestamp > 0) {
                // 비트레이트 계산 (kbps)
                const bitrateValue = (bytesReceived * 8 / 1000);
                bitrateSpan.textContent = bitrateValue.toFixed(0);
            }
        }

        // 지연시간 체크 시작
        function startLatencyCheck() {
            stopLatencyCheck();
            
            latencyCheckInterval = setInterval(() => {
                if (dataChannel && dataChannel.readyState === 'open') {
                    lastPingTime = Date.now();
                    sendControlMessage({ type: 'ping', timestamp: lastPingTime });
                }
            }, 5000);
        }

        // 지연시간 체크 중지
        function stopLatencyCheck() {
            if (latencyCheckInterval) {
                clearInterval(latencyCheckInterval);
                latencyCheckInterval = null;
            }
        }

        // 품질 변경
        qualitySelect.addEventListener('change', () => {
            const quality = qualitySelect.value;
            if (dataChannel && dataChannel.readyState === 'open') {
                sendControlMessage({ type: 'quality', value: quality });
            }
        });

        // 전체화면
        fullscreenBtn.addEventListener('click', () => {
            if (remoteVideo.requestFullscreen) {
                remoteVideo.requestFullscreen();
            } else if (remoteVideo.webkitRequestFullscreen) {
                remoteVideo.webkitRequestFullscreen();
            } else if (remoteVideo.msRequestFullscreen) {
                remoteVideo.msRequestFullscreen();
            }
        });

        // 새로고침
        refreshBtn.addEventListener('click', () => {
            if (dataChannel && dataChannel.readyState === 'open') {
                sendControlMessage({ type: 'restart' });
            }
        });

        // 연결 끊기
        disconnectBtn.addEventListener('click', () => {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            if (remoteVideo.srcObject) {
                remoteVideo.srcObject.getTracks().forEach(track => track.stop());
                remoteVideo.srcObject = null;
            }
            
            // UI 업데이트
            updateConnectionStatus('closed');
            screenContainer.classList.add('hidden');
            controls.classList.add('hidden');
            stats.classList.add('hidden');
        });

        // 연결 버튼 이벤트
        connectBtn.addEventListener('click', startConnection);
    </script>
</body>
</html>
