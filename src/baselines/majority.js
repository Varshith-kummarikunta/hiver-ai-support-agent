/**
 * Baseline 1: Majority Class Classifier.
 * Determines the empirical majority class from training data without leaking test labels.
 * Always predicts that empirical majority class as an intentionally weak benchmark.
 */

export class MajorityClassClassifier {
  constructor() {
    this.majorityClass = null;
    this.majorityCount = 0;
    this.majorityShare = 0;
    this.trainingSize = 0;
    this.classCounts = {};
    this.distribution = {};
    this.isFitted = false;
  }

  /**
   * Fit the classifier on training examples.
   * @param {Array<{intent: string} | string>} trainingData - Array of objects with .intent or string labels
   */
  fit(trainingData) {
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      throw new Error('MajorityClassClassifier.fit requires a non-empty array of training examples.');
    }

    this.trainingSize = trainingData.length;
    this.classCounts = {};

    for (const item of trainingData) {
      const label = typeof item === 'string' ? item : item.intent;
      if (!label) continue;
      this.classCounts[label] = (this.classCounts[label] || 0) + 1;
    }

    let maxCount = -1;
    let maxClass = null;

    for (const [cls, count] of Object.entries(this.classCounts)) {
      this.distribution[cls] = count / this.trainingSize;
      if (count > maxCount) {
        maxCount = count;
        maxClass = cls;
      }
    }

    if (!maxClass) {
      throw new Error('No valid class labels found in training data.');
    }

    this.majorityClass = maxClass;
    this.majorityCount = maxCount;
    this.majorityShare = maxCount / this.trainingSize;
    this.isFitted = true;

    return this;
  }

  /**
   * Predict the intent for a customer query.
   * @param {string} text - Customer inquiry text
   * @returns {{ intent: string, confidence: number, distribution: Record<string, number> }}
   */
  predict(text) {
    if (!this.isFitted) {
      throw new Error('MajorityClassClassifier must be fitted before predict() can be called.');
    }

    return {
      intent: this.majorityClass,
      confidence: Number(this.majorityShare.toFixed(4)),
      distribution: this.distribution
    };
  }

  /**
   * Batch predict an array of texts.
   */
  predictBatch(texts) {
    return texts.map(t => this.predict(t));
  }

  /**
   * Serialize classifier parameters to JSON.
   */
  toJSON() {
    return {
      modelType: 'MajorityClassClassifier',
      majorityClass: this.majorityClass,
      majorityCount: this.majorityCount,
      majorityShare: this.majorityShare,
      trainingSize: this.trainingSize,
      classCounts: this.classCounts,
      distribution: this.distribution,
      isFitted: this.isFitted
    };
  }

  /**
   * Rehydrate classifier from JSON object or string.
   */
  static fromJSON(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const clf = new MajorityClassClassifier();
    clf.majorityClass = parsed.majorityClass;
    clf.majorityCount = parsed.majorityCount;
    clf.majorityShare = parsed.majorityShare;
    clf.trainingSize = parsed.trainingSize;
    clf.classCounts = parsed.classCounts || {};
    clf.distribution = parsed.distribution || {};
    clf.isFitted = Boolean(parsed.isFitted);
    return clf;
  }
}
