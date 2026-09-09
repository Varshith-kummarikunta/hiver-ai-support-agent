/**
 * Evaluation Metrics Engine for Intent Classification.
 * Implements Accuracy, Macro/Weighted Precision, Recall, F1, and Confusion Matrix.
 * Pure JavaScript, zero external dependencies.
 */

export function calculateMetrics(yTrue, yPred, classLabels = null) {
  if (!yTrue || !yPred || yTrue.length !== yPred.length) {
    throw new Error(`Length mismatch: yTrue (${yTrue?.length}) vs yPred (${yPred?.length})`);
  }

  const n = yTrue.length;
  if (n === 0) {
    throw new Error('Cannot calculate metrics on empty arrays');
  }

  // Determine sorted list of unique classes
  const classes = classLabels
    ? [...classLabels]
    : Array.from(new Set([...yTrue, ...yPred])).sort();

  const classIndex = new Map();
  classes.forEach((c, idx) => classIndex.set(c, idx));
  const numClasses = classes.length;

  // Initialize confusion matrix: matrix[trueIdx][predIdx]
  const matrix = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));

  let correct = 0;
  for (let i = 0; i < n; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    if (t === p) correct++;

    const tIdx = classIndex.get(t);
    const pIdx = classIndex.get(p);

    if (tIdx !== undefined && pIdx !== undefined) {
      matrix[tIdx][pIdx]++;
    }
  }

  const accuracy = correct / n;

  // Per-class metrics
  const perClass = {};
  let macroPrecisionSum = 0;
  let macroRecallSum = 0;
  let macroF1Sum = 0;

  let weightedPrecisionSum = 0;
  let weightedRecallSum = 0;
  let weightedF1Sum = 0;

  classes.forEach((c, idx) => {
    const tp = matrix[idx][idx];
    let fp = 0;
    let fn = 0;

    for (let k = 0; k < numClasses; k++) {
      if (k !== idx) {
        fp += matrix[k][idx]; // predicted as c, but actually k
        fn += matrix[idx][k]; // actually c, but predicted as k
      }
    }

    const support = tp + fn; // Total true instances of class c
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[c] = {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support,
      tp,
      fp,
      fn
    };

    macroPrecisionSum += precision;
    macroRecallSum += recall;
    macroF1Sum += f1;

    weightedPrecisionSum += precision * support;
    weightedRecallSum += recall * support;
    weightedF1Sum += f1 * support;
  });

  const macroPrecision = numClasses > 0 ? macroPrecisionSum / numClasses : 0;
  const macroRecall = numClasses > 0 ? macroRecallSum / numClasses : 0;
  const macroF1 = numClasses > 0 ? macroF1Sum / numClasses : 0;

  const weightedPrecision = n > 0 ? weightedPrecisionSum / n : 0;
  const weightedRecall = n > 0 ? weightedRecallSum / n : 0;
  const weightedF1 = n > 0 ? weightedF1Sum / n : 0;

  return {
    totalSamples: n,
    correctSamples: correct,
    accuracy: Number(accuracy.toFixed(4)),
    macro: {
      precision: Number(macroPrecision.toFixed(4)),
      recall: Number(macroRecall.toFixed(4)),
      f1: Number(macroF1.toFixed(4))
    },
    weighted: {
      precision: Number(weightedPrecision.toFixed(4)),
      recall: Number(weightedRecall.toFixed(4)),
      f1: Number(weightedF1.toFixed(4))
    },
    perClass,
    classes,
    confusionMatrix: {
      labels: classes,
      matrix
    }
  };
}

/**
 * Formats a confusion matrix as a markdown table for reporting.
 */
export function formatConfusionMatrixMarkdown(confusionMatrix) {
  const { labels, matrix } = confusionMatrix;
  let md = '| True \\ Pred | ' + labels.map(l => `\`${l}\``).join(' | ') + ' | Total |\n';
  md += '| :--- | ' + labels.map(() => ':-:').join(' | ') + ' | :-: |\n';

  labels.forEach((tLabel, rowIdx) => {
    const row = matrix[rowIdx];
    const rowTotal = row.reduce((a, b) => a + b, 0);
    md += `| **\`${tLabel}\`** | ` + row.join(' | ') + ` | **${rowTotal}** |\n`;
  });

  // Column totals
  const colTotals = labels.map((_, colIdx) => matrix.reduce((acc, row) => acc + row[colIdx], 0));
  md += '| **Total** | ' + colTotals.map(c => `**${c}**`).join(' | ') + ` | **${colTotals.reduce((a, b) => a + b, 0)}** |\n`;

  return md;
}
