class MainScene extends Phaser.Scene {
	constructor() {
		super({ key: 'MainScene' });
		this.GRID_WIDTH = 8;
		this.GRID_HEIGHT = 10;
		this.TILE_SIZE = 44;
		this.grid = [];
		this.appleSprites = [];
		this.score = 0;
		this.timeLeft = 120;
		this.gameOver = false;
		this.isDragging = false;
		this.dragPath = [];
		this.highlightedApples = [];
	}

	preload() {
		// Create audio contexts for sound effects
		this.load.audio('select', ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTmNzfLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGI3bH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGI3bH8N2QQAoUXrTp66hVFApGn+DyvmzoKY']);
		this.load.audio('remove', ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTmNzfLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGI3bH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiP0fLPeSwGI3bH8N2QQoUXrTp66hVFApGn+DyvmzoKY']);
	}

	create() {
		this.cameras.main.setBackgroundColor('#2c3e50');

		// Create sound effects
		this.createSounds();

		// Initialize grid
		this.initializeGrid();

		// Create UI
		this.createUI();

		// Setup input
		this.setupInput();

		// Start timer
		this.startTimer();
	}

	createSounds() {
		// Create synthetic sound effects
		this.selectSound = this.createSelectSound();
		this.removeSound = this.createRemoveSound();
	}

	createSelectSound() {
		// Create a synthetic "pop" sound for selection
		const audioContext = this.sound.context;
		const sampleRate = audioContext.sampleRate;
		const duration = 0.1;
		const length = sampleRate * duration;
		const buffer = audioContext.createBuffer(1, length, sampleRate);
		const data = buffer.getChannelData(0);

		for (let i = 0; i < length; i++) {
			const t = i / sampleRate;
			data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 20) * 0.3;
		}

		return this.sound.add('select_synthetic', { volume: 0.3 });
	}

	createRemoveSound() {
		// Create a synthetic "ding" sound for removal
		const audioContext = this.sound.context;
		const sampleRate = audioContext.sampleRate;
		const duration = 0.3;
		const length = sampleRate * duration;
		const buffer = audioContext.createBuffer(1, length, sampleRate);
		const data = buffer.getChannelData(0);

		for (let i = 0; i < length; i++) {
			const t = i / sampleRate;
			data[i] = (Math.sin(2 * Math.PI * 523 * t) + Math.sin(2 * Math.PI * 659 * t)) * Math.exp(-t * 3) * 0.2;
		}

		return this.sound.add('remove_synthetic', { volume: 0.4 });
	}

	initializeGrid() {
		this.grid = [];
		this.appleSprites = [];

		for (let row = 0; row < this.GRID_HEIGHT; row++) {
			this.grid[row] = [];
			this.appleSprites[row] = [];
			for (let col = 0; col < this.GRID_WIDTH; col++) {
				this.grid[row][col] = this.getWeightedRandomNumber();
				this.createApple(row, col);
			}
		}
	}

	getWeightedRandomNumber() {
		// 4% 확률로 폭탄 사과 등장 (숫자 결정 규칙도 일반 사과와 동일하게 가중치 적용)
		const bombChance = 0.04;
		// 숫자별 가중치 설정 (전략적 게임플레이를 위한 확률 조절)
		const weights = {
			1: 16,  // 작은 숫자 중 최빈도. 여러 개를 묶어 합 10을 만드는 기초가 됨.
			2: 14,  // 두 번째로 자주 등장. "2+8" 조합보단 "2+3+5" 같은 조합 유도.
			3: 13,  // 중간 난이도 조합 지원.
			4: 12,  // "4+6" 같은 2개 조합도 어느 정도 나오며, "1+4+5" 등 3개 조합 지원
			5: 10,  // 절반값. "5+5" 조합은 맵상 5가 적으므로 희귀 페어가 됨.
			6: 9,   // 큰 숫자 중 상대적으로 자주 쓰이는 항목.
			7: 8,   // "7+3" 2개 조합이 가능하나 빈도 낮음.
			8: 6,   // "8+2" 조합지원, 많이 나오면 단순 조합이 너무 쉬워짐.
			9: 12   // "1+9" 매치 기회가 조절됨
		};
		const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
		let random = Phaser.Math.Between(0, totalWeight - 1);
		let chosenNumber = 1;
		for (let number = 1; number <= 9; number++) {
			random -= weights[number];
			if (random < 0) {
				chosenNumber = number;
				break;
			}
		}
		if (Math.random() < bombChance) {
			return { type: 'bomb', value: chosenNumber };
		}
		return chosenNumber;
	}

	createApple(row, col) {
		const boardStartX = (360 - (this.GRID_WIDTH * this.TILE_SIZE)) / 2;
		const boardStartY = 120;
		const x = boardStartX + col * this.TILE_SIZE + this.TILE_SIZE / 2;
		const y = boardStartY + row * this.TILE_SIZE + this.TILE_SIZE / 2;

		// 폭탄 사과는 색상만 다르고, 나머지 규칙은 동일
		let isBomb = false;
		let value = this.grid[row][col];
		if (typeof value === 'object' && value.type === 'bomb') {
			isBomb = true;
			value = value.value;
			this.grid[row][col] = value;
		}

		const apple = this.add.circle(x, y, 20, isBomb ? 0x222222 : 0xe74c3c);
		apple.setStrokeStyle(2, isBomb ? 0xffff00 : 0xc0392b);
		apple.setInteractive(new Phaser.Geom.Circle(apple.displayWidth * 0.5, apple.displayHeight * 0.5, apple.radius), Phaser.Geom.Circle.Contains);

		const number = this.add.text(x, y, value.toString(), {
			fontSize: '16px',
			fill: '#ffffff',
			fontWeight: 'bold'
		}).setOrigin(0.5).setPosition(x, y);

		apple.row = row;
		apple.col = col;
		apple.numberText = number;
		apple.originalTint = isBomb ? 0x222222 : 0xe74c3c;
		apple.isBomb = isBomb;
		this.appleSprites[row][col] = apple;

		// 드래그 방식 동일하게 적용
		apple.on('pointerdown', (pointer) => {
			this.startDrag(pointer, apple);
		});
		apple.on('pointerover', (pointer) => {
			this.continueOrStartDrag(pointer, apple);
		});
	}

	createUI() {
		// Header background
		const headerBg = this.add.rectangle(180, 40, 360, 80, 0x34495e);
		headerBg.setStrokeStyle(2, 0x2c3e50);

		// Score display (larger and centered)
		this.scoreText = this.add.text(180, 25, 'Score: 0', {
			fontSize: '22px',
			fill: '#f1c40f',
			fontWeight: 'bold',
			stroke: '#2c3e50',
			strokeThickness: 2
		}).setOrigin(0.5);

		// Timer progress bar (moved to bottom of header)
		this.createTimerProgressBar();

		// Timer display (number only, inside progress bar)
		this.timerText = this.add.text(180, 70, '120', {
			fontSize: '12px',
			fill: '#ffffff',
			fontWeight: 'bold'
		}).setOrigin(0.5);
		this.timerText.setDepth(10); // Make sure it's above the progress bar

		// Reset button (moved to top-right corner)
		this.resetButton = this.add.rectangle(330, 20, 50, 18, 0x3498db);
		this.resetButton.setStrokeStyle(1, 0x2980b9);
		this.resetButton.setInteractive();
		this.resetButtonText = this.add.text(330, 20, 'Reset', {
			fontSize: '10px',
			fill: '#ffffff',
			fontWeight: 'bold'
		}).setOrigin(0.5);

		this.resetButton.on('pointerdown', this.resetGame, this);

		// Game over background box (initially hidden)
		this.gameOverBox = this.add.rectangle(180, 350, 320, 100, 0x2c3e50, 0.95);
		this.gameOverBox.setStrokeStyle(3, 0xe74c3c);
		this.gameOverBox.setVisible(false);
		this.gameOverBox.setDepth(100);

		// Game over text (initially hidden)
		this.gameOverText = this.add.text(180, 350, '', {
			fontSize: '16px',
			fill: '#ffffff',
			fontWeight: 'bold',
			align: 'center'
		}).setOrigin(0.5).setVisible(false);
		this.gameOverText.setDepth(101);
	}

	createTimerProgressBar() {
		// Progress bar background
		this.progressBarBg = this.add.rectangle(180, 70, 320, 12, 0x2c3e50);
		this.progressBarBg.setStrokeStyle(2, 0x34495e);

		// Progress bar fill
		this.progressBarFill = this.add.rectangle(180, 70, 320, 8, 0x27ae60);
		this.progressBarFill.setOrigin(0.5, 0.5);

		// Warning overlay (changes color when time is low)
		this.progressBarWarning = this.add.rectangle(180, 70, 320, 8, 0xe74c3c);
		this.progressBarWarning.setOrigin(0.5, 0.5);
		this.progressBarWarning.setVisible(false);
	}

	setupInput() {
		// Global pointer up event
		this.input.on('pointerup', this.endDrag, this);

		// R key for reset
		this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		this.rKey.on('down', this.resetGame, this);
	}

	startTimer() {
		this.timer = this.time.addEvent({
			delay: 1000,
			callback: this.updateTimer,
			callbackScope: this,
			loop: true
		});
	}

	updateTimer() {
		if (this.gameOver) return;

		this.timeLeft--;
		this.timerText.setText(`${this.timeLeft}`);

		// Update progress bar
		this.updateProgressBar();

		if (this.timeLeft <= 0) {
			this.endGame();
		}
	}

	updateProgressBar() {
		const totalTime = 120;
		const percentage = this.timeLeft / totalTime;
		const newWidth = 320 * percentage;

		// Animate progress bar width
		this.tweens.add({
			targets: this.progressBarFill,
			scaleX: percentage,
			duration: 200,
			ease: 'Power2'
		});

		// Change color based on remaining time
		if (this.timeLeft <= 20) {
			// Critical time - red and flashing
			this.progressBarFill.setVisible(false);
			this.progressBarWarning.setVisible(true);
			this.progressBarWarning.scaleX = percentage;

			// Flash effect
			this.tweens.add({
				targets: this.progressBarWarning,
				alpha: 0.3,
				duration: 300,
				yoyo: true,
				repeat: 0
			});
		} else if (this.timeLeft <= 40) {
			// Warning time - orange
			this.progressBarFill.setVisible(true);
			this.progressBarWarning.setVisible(false);
			this.progressBarFill.fillColor = 0xf39c12;
		} else {
			// Normal time - green
			this.progressBarFill.setVisible(true);
			this.progressBarWarning.setVisible(false);
			this.progressBarFill.fillColor = 0x27ae60;
		}
	}

	startDrag(pointer, apple) {
		if (this.gameOver) return;
		// 폭탄 사과도 드래그 가능하도록 isBomb 체크 제거
		this.isDragging = true;
		this.dragPath = [apple];
		this.highlightApple(apple);
	}

	continueOrStartDrag(pointer, apple) {
		if (this.gameOver) return;
		// 폭탄 사과도 드래그 가능하도록 isBomb 체크 제거
		if (!this.isDragging) {
			if (pointer.isDown) {
				this.startDrag(pointer, apple);
			}
			return;
		}

		// Check if this apple is orthogonally adjacent to the last in path
		const lastApple = this.dragPath[this.dragPath.length - 1];
		const rowDiff = Math.abs(apple.row - lastApple.row);
		const colDiff = Math.abs(apple.col - lastApple.col);

		// Must be orthogonally adjacent (not diagonal)
		if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
			// Check if apple is already in path (backtracking)
			const existingIndex = this.dragPath.indexOf(apple);
			if (existingIndex !== -1) {
				// Remove apples from path after this point (backtrack)
				const removedApples = this.dragPath.splice(existingIndex + 1);
				removedApples.forEach(removedApple => this.unhighlightApple(removedApple));
			} else {
				// Add to path
				this.dragPath.push(apple);
				this.highlightApple(apple);
			}
		}
	}

	endDrag() {
		if (!this.isDragging || this.gameOver) return;

		this.isDragging = false;

		// Calculate sum
		const sum = this.dragPath.reduce((total, apple) => {
			return total + this.grid[apple.row][apple.col];
		}, 0);

		if (sum === 10 && this.dragPath.length > 1) {
			// Valid path - remove apples and calculate bonus score
			this.removeApples();
			// 점수 계산은 removeApples에서만 처리 (중복 방지)
		}

		// Clear highlighting and path
		this.clearHighlights();
		this.dragPath = [];
	}

	highlightApple(apple) {
		apple.fillColor = 0xf39c12; // Orange highlight
		this.highlightedApples.push(apple);

		// Play selection sound
		this.playSelectSound();
	}

	playSelectSound() {
		// Create a quick beep sound using WebAudio
		if (this.sound.context) {
			const audioContext = this.sound.context;
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
			gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.1);
		}
	}

	unhighlightApple(apple) {
		apple.fillColor = apple.originalTint;
		const index = this.highlightedApples.indexOf(apple);
		if (index !== -1) {
			this.highlightedApples.splice(index, 1);
		}
	}

	clearHighlights() {
		this.highlightedApples.forEach(apple => {
			apple.fillColor = apple.originalTint;
		});
		this.highlightedApples = [];
	}

	removeApples() {
		// Play removal sound
		this.playRemoveSound();

		// Create particle effects for each removed apple
		this.dragPath.forEach(apple => {
			this.createParticleEffect(apple.x, apple.y);
		});

		// 점수 계산: 드래그로 없앤 사과 개수만큼 보너스
		const n = this.dragPath.length;
		const bonusScore = (n * (n + 1)) / 2;
		this.score += bonusScore;
		this.scoreText.setText(`Score: ${this.score}`);

		// 폭탄 사과가 dragPath에 포함되어 있으면, 폭탄 효과 적용
		const bombApples = this.dragPath.filter(apple => apple.isBomb);
		let bombAffected = [];
		bombApples.forEach(bomb => {
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					const nr = bomb.row + dr;
					const nc = bomb.col + dc;
					if (nr >= 0 && nr < this.GRID_HEIGHT && nc >= 0 && nc < this.GRID_WIDTH) {
						const target = this.appleSprites[nr][nc];
						if (target && !this.dragPath.includes(target) && !bombAffected.includes(target)) {
							bombAffected.push(target);
						}
					}
				}
			}
		});

		// 폭탄에 의해 추가로 사라지는 사과 점수 가산
		this.score += bombAffected.length;
		if (bombAffected.length > 0) {
			this.scoreText.setText(`Score: ${this.score}`);
		}

		// Remove apples from grid and destroy sprites (드래그로 없앤 사과)
		this.dragPath.forEach(apple => {
			this.grid[apple.row][apple.col] = null;
			apple.numberText.destroy();
			apple.destroy();
			this.appleSprites[apple.row][apple.col] = null;
		});
		// Remove bombAffected apples (폭탄에 의해 터지는 사과는 약간 딜레이)
		if (bombAffected.length > 0) {
			this.time.delayedCall(250, () => {
				this.playBombSound(); // 폭탄 효과음 추가 (새로운 사운드)
				bombAffected.forEach(apple => {
					this.createParticleEffect(apple.x, apple.y);
					this.grid[apple.row][apple.col] = null;
					apple.numberText.destroy();
					apple.destroy();
					this.appleSprites[apple.row][apple.col] = null;
				});
			});
		}

		// Apply gravity and refill
		this.time.delayedCall(100 + (bombAffected.length > 0 ? 250 : 0), () => {
			this.applyGravity();
			this.time.delayedCall(300, () => {
				this.refillGrid();
			});
		});
	}

	playRemoveSound() {
		// Create a pleasant "ding" sound using WebAudio
		if (this.sound.context) {
			const audioContext = this.sound.context;
			const oscillator1 = audioContext.createOscillator();
			const oscillator2 = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator1.connect(gainNode);
			oscillator2.connect(gainNode);
			gainNode.connect(audioContext.destination);

			// Create a pleasant chord (C + E)
			oscillator1.frequency.setValueAtTime(523, audioContext.currentTime); // C5
			oscillator2.frequency.setValueAtTime(659, audioContext.currentTime); // E5

			gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

			oscillator1.start(audioContext.currentTime);
			oscillator2.start(audioContext.currentTime);
			oscillator1.stop(audioContext.currentTime + 0.3);
			oscillator2.stop(audioContext.currentTime + 0.3);
		}
	}

	playBombSound() {
		// 폭탄 느낌의 저음+노이즈 사운드
		if (this.sound.context) {
			const audioContext = this.sound.context;
			const duration = 0.35;
			const now = audioContext.currentTime;

			// 저음 오실레이터
			const osc = audioContext.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(90, now);
			osc.frequency.linearRampToValueAtTime(40, now + duration);

			// 노이즈
			const bufferSize = audioContext.sampleRate * duration;
			const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // 점점 줄어드는 노이즈
			}
			const noise = audioContext.createBufferSource();
			noise.buffer = buffer;

			// 믹스
			const gain = audioContext.createGain();
			gain.gain.setValueAtTime(0.18, now);
			gain.gain.linearRampToValueAtTime(0.01, now + duration);

			osc.connect(gain);
			noise.connect(gain);
			gain.connect(audioContext.destination);

			osc.start(now);
			osc.stop(now + duration);
			noise.start(now);
			noise.stop(now + duration);
		}
	}

	createParticleEffect(x, y) {
		// Create multiple star particles
		const particleCount = 8;
		const colors = [0xf1c40f, 0xe74c3c, 0x3498db, 0x2ecc71, 0xe67e22];

		for (let i = 0; i < particleCount; i++) {
			const angle = (i / particleCount) * Math.PI * 2;
			const speed = Phaser.Math.Between(50, 120);
			const color = colors[Phaser.Math.Between(0, colors.length - 1)];

			// Create star particle
			const star = this.add.star(x, y, 5, 4, 8, color);
			star.setDepth(50);

			// Calculate velocity
			const velocityX = Math.cos(angle) * speed;
			const velocityY = Math.sin(angle) * speed;

			// Animate particle
			this.tweens.add({
				targets: star,
				x: x + velocityX,
				y: y + velocityY,
				scaleX: 0,
				scaleY: 0,
				alpha: 0,
				duration: 600,
				ease: 'Power2',
				onComplete: () => {
					star.destroy();
				}
			});
		}

		// Add a central burst effect
		const burst = this.add.circle(x, y, 20, 0xffffff, 0.8);
		burst.setDepth(49);

		this.tweens.add({
			targets: burst,
			scaleX: 2,
			scaleY: 2,
			alpha: 0,
			duration: 300,
			ease: 'Power2',
			onComplete: () => {
				burst.destroy();
			}
		});
	}

	applyGravity() {
		// Only process columns that have null values (removed apples)
		for (let col = 0; col < this.GRID_WIDTH; col++) {
			let hasNull = false;
			for (let row = 0; row < this.GRID_HEIGHT; row++) {
				if (this.grid[row][col] === null) {
					hasNull = true;
					break;
				}
			}

			if (!hasNull) continue; // Skip columns with no removed apples

			// Collect non-null apples in this column from bottom to top
			const fallQueue = [];

			for (let row = this.GRID_HEIGHT - 1; row >= 0; row--) {
				if (this.grid[row][col] !== null) {
					fallQueue.push({
						value: this.grid[row][col],
						sprite: this.appleSprites[row][col]
					});
					this.grid[row][col] = null;
					this.appleSprites[row][col] = null;
				}
			}

			// Place apples at bottom, maintaining their order
			for (let i = 0; i < fallQueue.length; i++) {
				const newRow = this.GRID_HEIGHT - 1 - i;
				const apple = fallQueue[i];

				this.grid[newRow][col] = apple.value;
				this.appleSprites[newRow][col] = apple.sprite;

				// Update sprite position and references
				apple.sprite.row = newRow;
				apple.sprite.col = col;

				// Animate fall only if position changed
				const boardStartY = 120;
				const newY = boardStartY + newRow * this.TILE_SIZE + this.TILE_SIZE / 2;
				if (apple.sprite.y !== newY) {
					this.tweens.add({
						targets: [apple.sprite, apple.sprite.numberText],
						y: newY,
						duration: 200,
						ease: 'Bounce.easeOut'
					});
				}

				// applyGravity 내에서 폭탄 사과 이동 시 동기화
				if (apple.sprite.bombGraphics) {
					this.tweens.add({
						targets: [apple.sprite, apple.sprite.bombGraphics],
						y: newY,
						duration: 200,
						ease: 'Bounce.easeOut',
						onUpdate: () => {
							apple.sprite.bombGraphics.y = apple.sprite.y;
						}
					});
				} else {
					this.tweens.add({
						targets: [apple.sprite, apple.sprite.numberText],
						y: newY,
						duration: 200,
						ease: 'Bounce.easeOut'
					});
				}
			}
		}
	}

	refillGrid() {
		const boardStartX = (360 - (this.GRID_WIDTH * this.TILE_SIZE)) / 2;
		const boardStartY = 120;
		for (let col = 0; col < this.GRID_WIDTH; col++) {
			for (let row = 0; row < this.GRID_HEIGHT; row++) {
				if (this.grid[row][col] === null) {
					let value = this.getWeightedRandomNumber();
					let isBomb = false;
					if (typeof value === 'object' && value.type === 'bomb') {
						isBomb = true;
						this.grid[row][col] = value.value;
						value = value.value;
					} else {
						this.grid[row][col] = value;
					}

					const x = boardStartX + col * this.TILE_SIZE + this.TILE_SIZE / 2;
					const startY = boardStartY + row * this.TILE_SIZE + this.TILE_SIZE / 2 - 200;
					const endY = boardStartY + row * this.TILE_SIZE + this.TILE_SIZE / 2;

					const apple = this.add.circle(x, startY, 20, isBomb ? 0x222222 : 0xe74c3c);
					apple.setStrokeStyle(2, isBomb ? 0xffff00 : 0xc0392b);
					apple.setInteractive(new Phaser.Geom.Circle(apple.displayWidth * 0.5, apple.displayHeight * 0.5, apple.radius), Phaser.Geom.Circle.Contains);
					const number = this.add.text(x, startY, value.toString(), {
						fontSize: '16px', fill: '#ffffff', fontWeight: 'bold'
					}).setOrigin(0.5);

					apple.row = row;
					apple.col = col;
					apple.numberText = number;
					apple.originalTint = isBomb ? 0x222222 : 0xe74c3c;
					apple.isBomb = isBomb;
					
					this.appleSprites[row][col] = apple;

					apple.on('pointerdown', (pointer) => {
						this.startDrag(pointer, apple);
					});
					apple.on('pointerover', (pointer) => {
						this.continueOrStartDrag(pointer, apple);
					});

					this.tweens.add({
						targets: [apple, number],
						y: endY,
						duration: 300,
						ease: 'Bounce.easeOut',
						delay: row * 50
					});
				}
			}
		}
	}

	endGame() {
		this.gameOver = true;
		this.timer.destroy();

		this.gameOverBox.setVisible(true);
		this.gameOverText.setText(`Game Over!\nFinal Score: ${this.score}\nTouch Reset to play again`);
		this.gameOverText.setVisible(true);

		// Disable all apple interactions
		for (let row = 0; row < this.GRID_HEIGHT; row++) {
			for (let col = 0; col < this.GRID_WIDTH; col++) {
				if (this.appleSprites[row][col]) {
					this.appleSprites[row][col].disableInteractive();
				}
			}
		}
	}

	resetGame() {
		// Clear existing game
		this.gameOver = false;
		this.score = 0;
		this.timeLeft = 120;
		this.isDragging = false;
		this.dragPath = [];
		this.clearHighlights();

		if (this.timer) {
			this.timer.destroy();
		}

		// Destroy all existing apples
		for (let row = 0; row < this.GRID_HEIGHT; row++) {
			for (let col = 0; col < this.GRID_WIDTH; col++) {
				const apple = this.appleSprites[row][col];
				if (apple) {
					if (apple.numberText) apple.numberText.destroy();
					if (apple.bombGraphics) apple.bombGraphics.destroy();
					apple.destroy();
				}
			}
		}

		// Reinitialize
		this.initializeGrid();
		this.scoreText.setText('Score: 0');
		this.timerText.setText('120');

		// Reset progress bar
		this.progressBarFill.setVisible(true);
		this.progressBarWarning.setVisible(false);
		this.progressBarFill.fillColor = 0x27ae60;
		this.progressBarFill.scaleX = 1;
		this.progressBarFill.alpha = 1;

		this.gameOverBox.setVisible(false);
		this.gameOverText.setVisible(false);
		this.startTimer();
	}
}

const config = {
	type: Phaser.AUTO,
	width: 360,
	height: 640,
	backgroundColor: '#2c3e50',
	scene: MainScene
};

const game = new Phaser.Game(config);
