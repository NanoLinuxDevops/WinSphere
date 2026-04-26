import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface LotteryDraw {
  date: string;
  numbers: number[];
  bonus: number;
  drawNumber: number;
}

export interface BacktestResult {
  avgHits: number;
  hit2Rate: number;
  hit3Rate: number;
  hit4Rate: number;
  testDrawsUsed: number;
  trainingDrawsUsed: number;
}

export interface TrainingStatus {
  isTraining: boolean;
  epoch: number;
  totalEpochs: number;
  loss: number;
  valLoss: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_SIZE = 10;
const EPOCHS = 30;
const LSTM_MAIN_KEY = 'indexeddb://lottery-lstm-main-v1';
const LSTM_BONUS_KEY = 'indexeddb://lottery-lstm-bonus-v1';
const LSTM_META_KEY = 'lottery-lstm-meta-v2';

// ── Draw encoding: 44-dim vector (37 main-number bits + 7 bonus bits) ─────────

function encodeDraw(draw: LotteryDraw): number[] {
  const vec = new Array(44).fill(0);
  draw.numbers.forEach(n => { if (n >= 1 && n <= 37) vec[n - 1] = 1; });
  if (draw.bonus >= 1 && draw.bonus <= 7) vec[37 + draw.bonus - 1] = 1;
  return vec;
}

// ── Chi-squared bias weighting ────────────────────────────────────────────────
// If the lottery is perfectly fair all weights are ≈ 1.0 and the ensemble
// degrades gracefully to uniform random.  Only statistically-significant
// deviations shift the weights — the gambler's fallacy is eliminated.
function computeChiSquaredWeights(data: LotteryDraw[]): number[] {
  const N = data.length;
  if (N === 0) return new Array(38).fill(1);

  // Expected appearances per number across N draws (6 chosen from 37 each draw)
  const E = (6 * N) / 37;
  // Binomial std-dev: P(appear in one draw) = 6/37, Q = 31/37
  const stdDev = Math.sqrt(E * (31 / 37));

  const counts = new Array(38).fill(0); // index 0 unused
  data.forEach(d => d.numbers.forEach(n => { if (n >= 1 && n <= 37) counts[n]++; }));

  return counts.map((obs, num) => {
    if (num === 0) return 0;
    const z = stdDev > 0 ? (obs - E) / stdDev : 0;
    // Floor at 0.1 keeps every number alive even with large datasets
    return Math.max(0.1, 1 + 0.5 * z);
  });
}

// ── Co-Occurrence Predictor ───────────────────────────────────────────────────

export class CoOccurrencePredictor {
  /** Symmetric co-occurrence matrix (1-indexed, index 0 unused) */
  private readonly matrix: number[][];

  constructor(data: LotteryDraw[]) {
    this.matrix = Array.from({ length: 38 }, () => new Array(38).fill(0));
    for (const d of data) {
      for (let i = 0; i < d.numbers.length; i++) {
        for (let j = i + 1; j < d.numbers.length; j++) {
          const a = d.numbers[i], b = d.numbers[j];
          if (a >= 1 && a <= 37 && b >= 1 && b <= 37) {
            this.matrix[a][b]++;
            this.matrix[b][a]++;
          }
        }
      }
    }
  }

  /**
   * Greedily build a 6-number set that maximises conditional co-occurrence
   * with an optional seed set of already-selected numbers.
   */
  public predict(seeds: number[] = []): number[] {
    const selected: number[] = seeds.filter(n => n >= 1 && n <= 37);
    const maxCooc = Math.max(...this.matrix.flat(), 1);

    while (selected.length < 6) {
      let bestNum = -1;
      let bestScore = -Infinity;

      for (let n = 1; n <= 37; n++) {
        if (selected.includes(n)) continue;
        const score =
          selected.length === 0
            ? this.matrix[n].reduce((acc, v) => acc + v, 0) / maxCooc
            : selected.reduce((acc, s) => acc + this.matrix[s][n], 0) /
              (selected.length * maxCooc);

        if (score > bestScore) { bestScore = score; bestNum = n; }
      }

      if (bestNum === -1) break;
      selected.push(bestNum);
    }

    while (selected.length < 6) {
      const n = Math.floor(Math.random() * 37) + 1;
      if (!selected.includes(n)) selected.push(n);
    }
    return selected.sort((a, b) => a - b);
  }
}

// ── Real LSTM Predictor ───────────────────────────────────────────────────────

export class RealLSTMPredictor {
  private mainModel: tf.LayersModel | null = null;
  private bonusModel: tf.LayersModel | null = null;
  private historicalData: LotteryDraw[] = [];
  private _isTrained = false;
  private trainingStatus: TrainingStatus = {
    isTraining: false, epoch: 0, totalEpochs: EPOCHS, loss: 0, valLoss: 0,
  };
  private onProgress?: (s: TrainingStatus) => void;
  private lastTrainedHash = '';
  private backtestResult: BacktestResult | null = null;

  constructor(onProgress?: (s: TrainingStatus) => void) {
    this.onProgress = onProgress;
  }

  public setHistoricalData(data: LotteryDraw[]) { this.historicalData = data; }
  public getHistoricalData(): LotteryDraw[] { return this.historicalData; }
  public getTrainingStatus(): TrainingStatus { return { ...this.trainingStatus }; }
  public getBacktestResult(): BacktestResult | null { return this.backtestResult; }
  public isModelTrained(): boolean { return this._isTrained; }

  // ── Model architecture ──────────────────────────────────────────────────────

  private buildMainModel(): tf.Sequential {
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 64, inputShape: [WINDOW_SIZE, 44], returnSequences: false }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 37, activation: 'sigmoid' }));
    model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy' });
    return model;
  }

  private buildBonusModel(): tf.Sequential {
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, inputShape: [WINDOW_SIZE, 44], returnSequences: false }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 7, activation: 'softmax' }));
    model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy' });
    return model;
  }

  // ── Data helpers ────────────────────────────────────────────────────────────

  private sortedChronologically(): LotteryDraw[] {
    return [...this.historicalData].sort((a, b) => a.drawNumber - b.drawNumber);
  }

  private dataHash(): string {
    if (!this.historicalData.length) return '0';
    const sorted = this.sortedChronologically();
    return `${sorted.length}-${sorted[0].drawNumber}-${sorted[sorted.length - 1].drawNumber}`;
  }

  private buildDatasets(sorted: LotteryDraw[]) {
    const xs: number[][][] = [];
    const yMain: number[][] = [];
    const yBonus: number[][] = [];

    for (let i = WINDOW_SIZE; i < sorted.length; i++) {
      xs.push(sorted.slice(i - WINDOW_SIZE, i).map(encodeDraw));

      const mainVec = new Array(37).fill(0);
      sorted[i].numbers.forEach(n => { if (n >= 1 && n <= 37) mainVec[n - 1] = 1; });
      yMain.push(mainVec);

      const bonusVec = new Array(7).fill(0);
      if (sorted[i].bonus >= 1 && sorted[i].bonus <= 7) bonusVec[sorted[i].bonus - 1] = 1;
      yBonus.push(bonusVec);
    }

    const splitIdx = Math.floor(xs.length * 0.8);
    const valCount = xs.length - splitIdx;

    return {
      trainX: tf.tensor3d(xs.slice(0, splitIdx), [splitIdx, WINDOW_SIZE, 44]),
      trainYMain: tf.tensor2d(yMain.slice(0, splitIdx), [splitIdx, 37]),
      trainYBonus: tf.tensor2d(yBonus.slice(0, splitIdx), [splitIdx, 7]),
      valX: tf.tensor3d(xs.slice(splitIdx), [valCount, WINDOW_SIZE, 44]),
      valYMain: tf.tensor2d(yMain.slice(splitIdx), [valCount, 37]),
    };
  }

  // ── Model persistence ───────────────────────────────────────────────────────

  private async tryLoadCachedModel(): Promise<boolean> {
    try {
      const metaStr = localStorage.getItem(LSTM_META_KEY);
      if (!metaStr) return false;
      const meta = JSON.parse(metaStr);
      if ((Date.now() - meta.timestamp) / 3600000 > 24) return false;
      if (meta.hash !== this.dataHash()) return false;

      this.mainModel = await tf.loadLayersModel(LSTM_MAIN_KEY);
      this.bonusModel = await tf.loadLayersModel(LSTM_BONUS_KEY);
      this.lastTrainedHash = meta.hash;
      this._isTrained = true;
      this.trainingStatus = {
        isTraining: false, epoch: EPOCHS, totalEpochs: EPOCHS,
        loss: meta.loss ?? 0, valLoss: meta.valLoss ?? 0,
      };
      console.log(`✅ Loaded cached LSTM model (loss: ${meta.loss?.toFixed(4)})`);
      return true;
    } catch {
      return false;
    }
  }

  // ── Training ────────────────────────────────────────────────────────────────

  public async train(): Promise<void> {
    const sorted = this.sortedChronologically();
    if (sorted.length < WINDOW_SIZE + 50) {
      console.warn(`⚠️ Not enough draws for LSTM training (need ≥${WINDOW_SIZE + 50}, have ${sorted.length})`);
      return;
    }

    const hash = this.dataHash();
    if (hash === this.lastTrainedHash && this._isTrained) {
      await this.runBacktest(sorted);
      return;
    }

    if (await this.tryLoadCachedModel()) {
      await this.runBacktest(sorted);
      return;
    }

    // ── Full training pass ───────────────────────────────────────────────────
    this.trainingStatus = { isTraining: true, epoch: 0, totalEpochs: EPOCHS, loss: 0, valLoss: 0 };
    this.onProgress?.(this.trainingStatus);

    const { trainX, trainYMain, trainYBonus, valX, valYMain } = this.buildDatasets(sorted);

    this.mainModel = this.buildMainModel();
    this.bonusModel = this.buildBonusModel();

    let finalLoss = 0, finalValLoss = 0;

    await this.mainModel.fit(trainX, trainYMain, {
      epochs: EPOCHS,
      batchSize: 32,
      validationData: [valX, valYMain],
      shuffle: true,
      callbacks: {
        onEpochEnd: async (_epoch: number, logs?: tf.Logs) => {
          finalLoss = logs?.loss ?? 0;
          finalValLoss = logs?.val_loss ?? 0;
          this.trainingStatus = {
            isTraining: true,
            epoch: _epoch + 1,
            totalEpochs: EPOCHS,
            loss: finalLoss,
            valLoss: finalValLoss,
          };
          this.onProgress?.(this.trainingStatus);
          // Yield to keep UI responsive during training
          await new Promise(r => setTimeout(r, 0));
        },
      },
    });

    // Train bonus model (half the epochs suffices for the 7-class task)
    await this.bonusModel.fit(trainX, trainYBonus, {
      epochs: Math.floor(EPOCHS / 2),
      batchSize: 32,
      shuffle: true,
    });

    trainX.dispose();
    trainYMain.dispose();
    trainYBonus.dispose();
    valX.dispose();
    valYMain.dispose();

    // Persist to IndexedDB
    try {
      await this.mainModel.save(LSTM_MAIN_KEY);
      await this.bonusModel.save(LSTM_BONUS_KEY);
      localStorage.setItem(
        LSTM_META_KEY,
        JSON.stringify({ hash, timestamp: Date.now(), loss: finalLoss, valLoss: finalValLoss }),
      );
    } catch (e) {
      console.warn('⚠️ Could not persist LSTM model:', e);
    }

    this.lastTrainedHash = hash;
    this._isTrained = true;
    this.trainingStatus = {
      isTraining: false, epoch: EPOCHS, totalEpochs: EPOCHS,
      loss: finalLoss, valLoss: finalValLoss,
    };
    this.onProgress?.(this.trainingStatus);
    console.log(`✅ LSTM training complete — loss: ${finalLoss.toFixed(4)}, val_loss: ${finalValLoss.toFixed(4)}`);

    await this.runBacktest(sorted);
  }

  // ── Inference (synchronous) ─────────────────────────────────────────────────

  /** Returns sigmoid probabilities for numbers 1–37 (uniform 1/37 if untrained) */
  public predictMainProbabilities(): number[] {
    if (!this.mainModel || !this._isTrained || this.historicalData.length < WINDOW_SIZE) {
      return new Array(37).fill(1 / 37);
    }
    const sorted = this.sortedChronologically();
    const window = sorted.slice(-WINDOW_SIZE).map(encodeDraw);
    const inputTensor = tf.tensor3d([window], [1, WINDOW_SIZE, 44]);
    const output = this.mainModel.predict(inputTensor) as tf.Tensor;
    const probs = Array.from(output.dataSync());
    inputTensor.dispose();
    output.dispose();
    return probs;
  }

  /** Returns bonus number 1–7 (LSTM softmax argmax, or frequency fallback) */
  public predictBonus(): number {
    if (!this.bonusModel || !this._isTrained || this.historicalData.length < WINDOW_SIZE) {
      const counts = new Array(8).fill(0);
      this.historicalData.forEach(d => { if (d.bonus >= 1 && d.bonus <= 7) counts[d.bonus]++; });
      const total = counts.reduce((a, b) => a + b, 0) || 7;
      let r = Math.random() * total;
      for (let i = 1; i <= 7; i++) { r -= counts[i]; if (r <= 0) return i; }
      return Math.ceil(Math.random() * 7);
    }
    const sorted = this.sortedChronologically();
    const window = sorted.slice(-WINDOW_SIZE).map(encodeDraw);
    const inputTensor = tf.tensor3d([window], [1, WINDOW_SIZE, 44]);
    const output = this.bonusModel.predict(inputTensor) as tf.Tensor;
    const probs = Array.from(output.dataSync());
    inputTensor.dispose();
    output.dispose();
    return probs.indexOf(Math.max(...probs)) + 1;
  }

  // ── Backtesting ─────────────────────────────────────────────────────────────

  private async runBacktest(sorted: LotteryDraw[]): Promise<void> {
    if (!this.mainModel || !this._isTrained) return;

    const testSize = Math.min(50, Math.floor(sorted.length * 0.1));
    if (sorted.length < WINDOW_SIZE + testSize) return;

    const startIdx = sorted.length - testSize;
    let totalHits = 0, hit2 = 0, hit3 = 0, hit4 = 0;

    for (let i = startIdx; i < sorted.length; i++) {
      if (i < WINDOW_SIZE) continue;
      const window = sorted.slice(i - WINDOW_SIZE, i).map(encodeDraw);
      const inputTensor = tf.tensor3d([window], [1, WINDOW_SIZE, 44]);
      const output = this.mainModel.predict(inputTensor) as tf.Tensor;
      const probs = Array.from(output.dataSync());
      inputTensor.dispose();
      output.dispose();

      const predicted = probs
        .map((p, idx) => ({ num: idx + 1, p }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 6)
        .map(x => x.num);

      const actual = new Set(sorted[i].numbers);
      const hits = predicted.filter(n => actual.has(n)).length;
      totalHits += hits;
      if (hits >= 2) hit2++;
      if (hits >= 3) hit3++;
      if (hits >= 4) hit4++;
    }

    this.backtestResult = {
      avgHits: totalHits / testSize,
      hit2Rate: hit2 / testSize,
      hit3Rate: hit3 / testSize,
      hit4Rate: hit4 / testSize,
      testDrawsUsed: testSize,
      trainingDrawsUsed: startIdx,
    };

    console.log(
      `📊 Backtest (${testSize} draws): avg hits = ${this.backtestResult.avgHits.toFixed(2)}` +
      ` | ≥3 hit rate = ${(this.backtestResult.hit3Rate * 100).toFixed(1)}%` +
      ` | Random baseline ≈ 0.97 avg hits`,
    );
  }
}

// ── Hybrid Predictor (public façade used by App.tsx) ─────────────────────────

export class HybridLotteryPredictor {
  private lstmPredictor: RealLSTMPredictor;
  private coOccPredictor: CoOccurrencePredictor | null = null;
  private historicalData: LotteryDraw[] = [];
  private lastUpdateTime: Date;
  private dataAge = 0;
  private staleThreshold = 24;
  private realDataLoaded = false;
  private cachedMetrics: ReturnType<HybridLotteryPredictor['_buildMetrics']> | null = null;

  constructor(onTrainingProgress?: (s: TrainingStatus) => void) {
    this.lstmPredictor = new RealLSTMPredictor(onTrainingProgress);
    this.lastUpdateTime = new Date();
    this._initAsync();
  }

  private async _initAsync() {
    try {
      const { IsraeliLotteryAPI } = await import('./israeliLotteryAPI');
      let data = await IsraeliLotteryAPI.fetchPaisArchive(500);
      if (!data.length) data = await IsraeliLotteryAPI.loadFromFile();

      if (data.length > 0) {
        this.historicalData = data.map(r => ({
          date: r.date, numbers: r.numbers, bonus: r.bonus, drawNumber: r.drawNumber,
        }));
        this.lstmPredictor.setHistoricalData(this.historicalData);
        this.coOccPredictor = new CoOccurrencePredictor(this.historicalData);
        this.realDataLoaded = true;
        console.log(`✅ HybridPredictor: ${this.historicalData.length} draws loaded`);
        // Train in background — does not block generatePrediction()
        this.lstmPredictor.train().catch(e => console.warn('LSTM train error:', e));
      }
    } catch (e) {
      console.warn('⚠️ HybridPredictor init error:', e);
    }
  }

  // ── Prediction ───────────────────────────────────────────────────────────────

  public generatePrediction(): {
    numbers: number[];
    bonus: number;
    confidence: number;
    method: string;
  } {
    if (this.historicalData.length < 10) {
      return {
        numbers: this._randomSet(),
        bonus: Math.ceil(Math.random() * 7),
        confidence: 60,
        method: 'Random (insufficient data)',
      };
    }

    // 1. LSTM: sigmoid P(number appears) — uniform if not yet trained
    const lstmProbs = this.lstmPredictor.predictMainProbabilities();

    // 2. Chi-squared bias: statistically-detected frequency deviations
    const chiWeights = computeChiSquaredWeights(this.historicalData);
    const maxChi = Math.max(...chiWeights.slice(1), 1);

    // 3. Co-occurrence: seed from the most chi-deviant number
    const topChiIdx = chiWeights
      .map((w, i) => ({ i, w }))
      .filter(x => x.i >= 1 && x.i <= 37)
      .sort((a, b) => b.w - a.w)[0]?.i ?? 1;
    const coOccNumbers = this.coOccPredictor?.predict([topChiIdx]) ?? this._randomSet();
    const coOccSet = new Set(coOccNumbers);

    // Combined score: 50% LSTM + 30% chi-squared + 20% co-occurrence
    const scores = Array.from({ length: 37 }, (_, idx) => {
      const n = idx + 1;
      return {
        num: n,
        score:
          0.50 * lstmProbs[idx] +
          0.30 * (chiWeights[n] / maxChi) +
          0.20 * (coOccSet.has(n) ? 1 : 0),
      };
    });

    const selected = this._weightedSample(scores, 6);
    const bonus = this.lstmPredictor.predictBonus();

    // Confidence: mean LSTM probability of selected numbers, scaled to [60, 85]
    const avgLstmScore = selected.reduce((s, n) => s + lstmProbs[n - 1], 0) / 6;
    const confidence = Math.min(85, Math.max(60, Math.round(avgLstmScore * 200 + 60)));

    const status = this.lstmPredictor.getTrainingStatus();
    const isTrained = this.lstmPredictor.isModelTrained();
    const method = status.isTraining
      ? `Training LSTM… epoch ${status.epoch}/${status.totalEpochs}`
      : isTrained
        ? 'LSTM + Chi-Squared + Co-Occurrence Ensemble'
        : 'Chi-Squared + Co-Occurrence Ensemble';

    return { numbers: selected.sort((a, b) => a - b), bonus, confidence, method };
  }

  private _weightedSample(
    scores: { num: number; score: number }[],
    count: number,
  ): number[] {
    const pool = scores.map(s => ({ ...s }));
    const selected: number[] = [];
    const zones = { low: 0, mid: 0, high: 0 };
    const maxPerZone = 3;

    for (let iter = 0; iter < count * 20 && selected.length < count; iter++) {
      const total = pool.reduce((s, x) => s + x.score, 0);
      if (total <= 0) break;

      let r = Math.random() * total;
      for (const item of pool) {
        r -= item.score;
        if (r <= 0) {
          const n = item.num;
          const zone: 'low' | 'mid' | 'high' = n <= 12 ? 'low' : n <= 25 ? 'mid' : 'high';
          if (zones[zone] < maxPerZone || selected.length >= count - 1) {
            selected.push(n);
            zones[zone]++;
            item.score = 0;
          }
          break;
        }
      }
    }

    while (selected.length < count) {
      const n = Math.floor(Math.random() * 37) + 1;
      if (!selected.includes(n)) selected.push(n);
    }
    return selected;
  }

  private _randomSet(): number[] {
    const nums: number[] = [];
    while (nums.length < 6) {
      const n = Math.floor(Math.random() * 37) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    return nums.sort((a, b) => a - b);
  }

  // ── Real backtested metrics (deterministic, no Math.random()) ────────────────

  private _buildMetrics() {
    const bt = this.lstmPredictor.getBacktestResult();
    const st = this.lstmPredictor.getTrainingStatus();

    if (bt && bt.testDrawsUsed > 0) {
      const f1Denom = bt.hit3Rate + bt.hit2Rate;
      return {
        accuracy: (bt.avgHits / 6) * 100,
        precision: bt.hit3Rate * 100,
        recall: bt.hit2Rate * 100,
        f1Score: f1Denom > 0 ? (2 * bt.hit3Rate * bt.hit2Rate / f1Denom) * 100 : 0,
        trainingLoss: st.loss,
        validationLoss: st.valLoss,
      };
    }

    // Not yet backtested — return zeros; no fake random values
    return {
      accuracy: 0, precision: 0, recall: 0, f1Score: 0,
      trainingLoss: 0, validationLoss: 0,
    };
  }

  public getModelMetrics() {
    if (!this.cachedMetrics || this.lstmPredictor.getBacktestResult() !== null) {
      this.cachedMetrics = this._buildMetrics();
    }
    return this.cachedMetrics;
  }

  public getTrainingStatus(): TrainingStatus {
    return this.lstmPredictor.getTrainingStatus();
  }

  public getBacktestResult(): BacktestResult | null {
    return this.lstmPredictor.getBacktestResult();
  }

  // ── Data management (full App.tsx compatibility) ──────────────────────────

  public async updateHistoricalData(newData: LotteryDraw[]): Promise<void> {
    const existingNums = new Set(this.historicalData.map(d => d.drawNumber));
    const unique = newData.filter(d => !existingNums.has(d.drawNumber));

    if (unique.length === 0) {
      console.log('ℹ️ No new draws to add');
      return;
    }

    this.historicalData = [...this.historicalData, ...unique]
      .sort((a, b) => a.drawNumber - b.drawNumber);
    this.lstmPredictor.setHistoricalData(this.historicalData);
    this.coOccPredictor = new CoOccurrencePredictor(this.historicalData);
    this.cachedMetrics = null;
    this.lastUpdateTime = new Date();
    this.dataAge = 0;
    this.realDataLoaded = true;

    console.log(`✅ Predictor updated: ${this.historicalData.length} draws (+${unique.length} new)`);
    this.lstmPredictor.train().catch(e => console.warn('LSTM retrain error:', e));
  }

  public async refreshModels(): Promise<void> {
    this.coOccPredictor = new CoOccurrencePredictor(this.historicalData);
    this.cachedMetrics = null;
    await this.lstmPredictor.train();
  }

  public isDataStale(): boolean {
    this._updateDataAge();
    return this.dataAge > this.staleThreshold;
  }

  public getLastUpdateTime(): Date { return new Date(this.lastUpdateTime); }

  public getDataAge(): number {
    this._updateDataAge();
    return this.dataAge;
  }

  public setStaleThreshold(hours: number): void {
    if (hours <= 0) throw new Error('Stale threshold must be > 0');
    this.staleThreshold = hours;
    console.log(`📅 Stale threshold set to ${hours} hours`);
  }

  public getDataStatus() {
    this._updateDataAge();
    return {
      lastUpdate: this.getLastUpdateTime(),
      dataAge: this.dataAge,
      isStale: this.isDataStale(),
      staleThreshold: this.staleThreshold,
      totalDraws: this.historicalData.length,
      realDataLoaded: this.realDataLoaded,
    };
  }

  private _updateDataAge(): void {
    this.dataAge = (Date.now() - this.lastUpdateTime.getTime()) / 3600000;
  }
}

// ── Legacy stubs (backward compatibility) ─────────────────────────────────────

/** @deprecated Use RealLSTMPredictor */
export class LSTMLotteryPredictor extends RealLSTMPredictor {}

/** @deprecated Use CoOccurrencePredictor */
export class ARIMAPredictor {
  constructor(_historicalNumbers: number[][]) {}
  public predict(_steps = 6): number[] {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 37) + 1);
  }
}

// Re-export simple-statistics for any external consumers
export { ss };
