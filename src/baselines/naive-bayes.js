/**
 * Baseline 2: Multinomial Naive Bayes Classifier with TF-IDF Features.
 * Implements deterministic log-space inference with Laplace smoothing.
 * Pure JavaScript, zero external dependencies, no Python, no LLM.
 */

import { TfidfVectorizer } from './tfidf.js';

export class MultinomialNaiveBayesClassifier {
  constructor(options = {}) {
    this.alpha = options.alpha ?? 0.5; // Laplace smoothing parameter
    this.classPriorMode = options.classPriorMode ?? 'uniform'; // 'uniform' or 'empirical'
    this.vectorizer = options.vectorizer || new TfidfVectorizer(options.vectorizerOptions);

    this.classes = [];
    this.classIndex = new Map();
    this.classPriors = [];      // log P(c)
    this.featureProbMatrix = [];// featureProbMatrix[classIdx][featureIdx] = log P(w|c)
    this.defaultFeatureLogProb = []; // log P(unseen_w | c) = log(alpha / (Tc + alpha * |V|))
    this.trainingDocCount = 0;
    this.isFitted = false;
  }

  /**
   * Train the classifier on labeled customer messages.
   * @param {Array<{text: string, intent: string}>} trainingData
   */
  fit(trainingData) {
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      throw new Error('NaiveBayes.fit requires a non-empty array of {text, intent} objects.');
    }

    this.trainingDocCount = trainingData.length;

    // 1. Determine unique classes and document indices
    const classDocs = new Map();
    for (let i = 0; i < trainingData.length; i++) {
      const { intent } = trainingData[i];
      if (!intent) continue;
      if (!classDocs.has(intent)) {
        classDocs.set(intent, []);
      }
      classDocs.get(intent).push(i);
    }

    this.classes = Array.from(classDocs.keys()).sort();
    this.classIndex.clear();
    this.classes.forEach((c, idx) => this.classIndex.set(c, idx));
    const numClasses = this.classes.length;

    // 2. Fit TF-IDF Vectorizer on all training documents
    const documents = trainingData.map(d => d.text || '');
    this.vectorizer.fit(documents);

    const numFeatures = this.vectorizer.featureNames.length;
    if (numFeatures === 0) {
      throw new Error('TF-IDF Vectorizer extracted zero features from training corpus.');
    }

    // 3. Compute class priors
    this.classPriors = new Array(numClasses);
    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      const c = this.classes[cIdx];
      const count = classDocs.get(c).length;
      if (this.classPriorMode === 'uniform') {
        this.classPriors[cIdx] = -Math.log(numClasses);
      } else {
        this.classPriors[cIdx] = Math.log(count / this.trainingDocCount);
      }
    }

    // 4. Compute feature weights per class
    // classFeatureSums[cIdx][fIdx] = sum of TF-IDF weights for feature fIdx in class cIdx
    const classFeatureSums = Array.from({ length: numClasses }, () => new Float64Array(numFeatures));
    const classTotalWeights = new Float64Array(numClasses);

    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      const docIndices = classDocs.get(this.classes[cIdx]);
      for (const dIdx of docIndices) {
        const sparseVec = this.vectorizer.transform(documents[dIdx]);
        for (const [fIdx, weight] of sparseVec.entries()) {
          classFeatureSums[cIdx][fIdx] += weight;
          classTotalWeights[cIdx] += weight;
        }
      }
    }

    // 5. Compute smoothed log conditional probabilities: log P(w|c)
    this.featureProbMatrix = Array.from({ length: numClasses }, () => new Float64Array(numFeatures));
    this.defaultFeatureLogProb = new Float64Array(numClasses);

    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      const denominator = classTotalWeights[cIdx] + this.alpha * numFeatures;
      this.defaultFeatureLogProb[cIdx] = Math.log(this.alpha / denominator);

      for (let fIdx = 0; fIdx < numFeatures; fIdx++) {
        const numerator = classFeatureSums[cIdx][fIdx] + this.alpha;
        this.featureProbMatrix[cIdx][fIdx] = Math.log(numerator / denominator);
      }
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Predict intent and confidence for a customer inquiry.
   * @param {string} text - Customer inquiry
   * @returns {{ intent: string, confidence: number, probabilities: Record<string, number> }}
   */
  predict(text) {
    if (!this.isFitted) {
      throw new Error('Classifier must be fitted before predict()');
    }

    const numClasses = this.classes.length;
    const sparseVec = this.vectorizer.transform(text || '');

    // Edge case: empty or completely out-of-vocabulary text
    if (sparseVec.size === 0) {
      // Return class with highest prior (or other_unclear fallback if available)
      const fallbackClass = this.classes.includes('other_unclear') ? 'other_unclear' : this.classes[0];
      const probs = {};
      this.classes.forEach(c => (probs[c] = c === fallbackClass ? 1.0 : 0.0));
      return {
        intent: fallbackClass,
        confidence: 0.5,
        probabilities: probs,
        isOutOfVocabulary: true
      };
    }

    // Compute log posterior scores: log P(c) + sum(weight_j * log P(w_j|c))
    const logScores = new Float64Array(numClasses);
    let maxLogScore = -Infinity;

    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      let score = this.classPriors[cIdx];
      for (const [fIdx, weight] of sparseVec.entries()) {
        score += weight * this.featureProbMatrix[cIdx][fIdx];
      }
      logScores[cIdx] = score;
      if (score > maxLogScore) {
        maxLogScore = score;
      }
    }

    // Softmax via LogSumExp for numerical stability
    let sumExp = 0;
    const expScores = new Float64Array(numClasses);
    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      const expVal = Math.exp(logScores[cIdx] - maxLogScore);
      expScores[cIdx] = expVal;
      sumExp += expVal;
    }

    let bestClassIdx = 0;
    let highestProb = -1;
    const probabilities = {};

    for (let cIdx = 0; cIdx < numClasses; cIdx++) {
      const prob = sumExp > 0 ? expScores[cIdx] / sumExp : 1 / numClasses;
      const clsName = this.classes[cIdx];
      probabilities[clsName] = Number(prob.toFixed(4));
      if (prob > highestProb) {
        highestProb = prob;
        bestClassIdx = cIdx;
      }
    }

    return {
      intent: this.classes[bestClassIdx],
      confidence: Number(highestProb.toFixed(4)),
      probabilities,
      isOutOfVocabulary: false
    };
  }

  /**
   * Batch predict an array of customer texts.
   */
  predictBatch(texts) {
    return texts.map(t => this.predict(t));
  }

  /**
   * Serialize trained model to JSON.
   */
  toJSON() {
    return {
      modelType: 'MultinomialNaiveBayesClassifier',
      alpha: this.alpha,
      classPriorMode: this.classPriorMode,
      classes: this.classes,
      classPriors: Array.from(this.classPriors),
      defaultFeatureLogProb: Array.from(this.defaultFeatureLogProb),
      featureProbMatrix: this.featureProbMatrix.map(row => Array.from(row)),
      trainingDocCount: this.trainingDocCount,
      vectorizer: this.vectorizer.toJSON(),
      isFitted: this.isFitted
    };
  }

  /**
   * Rehydrate classifier from JSON object or string.
   */
  static fromJSON(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const clf = new MultinomialNaiveBayesClassifier({
      alpha: parsed.alpha,
      classPriorMode: parsed.classPriorMode,
      vectorizer: TfidfVectorizer.fromJSON(parsed.vectorizer)
    });

    clf.classes = parsed.classes || [];
    clf.classIndex = new Map();
    clf.classes.forEach((c, idx) => clf.classIndex.set(c, idx));
    clf.classPriors = Float64Array.from(parsed.classPriors || []);
    clf.defaultFeatureLogProb = Float64Array.from(parsed.defaultFeatureLogProb || []);
    clf.featureProbMatrix = (parsed.featureProbMatrix || []).map(row => Float64Array.from(row));
    clf.trainingDocCount = parsed.trainingDocCount;
    clf.isFitted = Boolean(parsed.isFitted);
    return clf;
  }
}
