export interface ExplainerSection {
  header: string
  content: string
}

export type AlgorithmId =
  | 'kmeans'
  | 'linear-regression'
  | 'decision-tree'
  | 'neural-network'
  | 'gradient-descent'

export const EXPLAINERS: Record<AlgorithmId, ExplainerSection[]> = {
  kmeans: [
    {
      header: 'WHAT PROBLEM IT SOLVES',
      content: `K-Means answers the question: "I have a pile of unlabeled data — can the computer find natural groupings on its own?" You don't tell it which group each point belongs to. You only tell it how many groups (K) to look for. This makes it an unsupervised learning algorithm — it learns structure from data without any labels or correct answers to guide it.`,
    },
    {
      header: 'THE INTUITION',
      content: `Imagine you walk into a party and you have to assign everyone to one of three tables, but you can only use one rule: everyone should sit at the table whose host is closest to them. After everyone sits, each host walks to the center of their group. Then everyone has to move again to whoever's now closest. You repeat this until nobody moves. That's K-Means. The "centroids" are the hosts, and the algorithm alternates between two simple steps until it stabilizes.`,
    },
    {
      header: 'HOW THE MATH WORKS — STEP BY STEP',
      content: `Step 1 — Initialization: Place K centroids randomly in the feature space.
Step 2 — Assignment: For every data point, compute the Euclidean distance to each centroid. Assign the point to the nearest one. This forms K clusters.
Step 3 — Update: Recalculate each centroid as the mean (average) of all points currently assigned to it. The centroid literally moves to the center of its cluster.
Step 4 — Repeat: Go back to Step 2. Points may switch clusters as centroids move.
Step 5 — Convergence: Stop when no point changes its cluster between iterations. The algorithm has found a locally stable solution.

The objective function being minimized is called Within-Cluster Sum of Squares (WCSS): the total squared distance from each point to its assigned centroid. K-Means is guaranteed to converge, but not guaranteed to find the global optimum — the result depends on where centroids started.`,
    },
    {
      header: 'REAL WORLD USES',
      content: `Customer segmentation (group shoppers by behavior without predefined categories), image compression (reduce colors by clustering similar pixel values), document clustering (group news articles by topic), anomaly detection (points that don't fit any cluster well are outliers).`,
    },
    {
      header: 'WHAT CAN GO WRONG',
      content: `K-Means struggles with clusters of very different sizes or densities. It assumes clusters are roughly spherical. If you pick the wrong K, the results are meaningless — techniques like the Elbow Method or Silhouette Score help choose K. Random initialization can cause bad results; K-Means++ initialization fixes this by spreading starting centroids out deliberately.`,
    },
    {
      header: 'CONNECTION TO OTHER ALGORITHMS',
      content: `K-Means is the simplest member of the clustering family. DBSCAN is a more flexible alternative that doesn't require you to specify K. Gaussian Mixture Models do the same thing but with probability distributions instead of hard assignments. Hierarchical clustering builds a full tree of possible groupings.`,
    },
  ],

  'linear-regression': [
    {
      header: 'WHAT PROBLEM IT SOLVES',
      content: `Linear regression answers: "Given some input features, can I predict a continuous number?" — a house price, a patient's blood pressure, tomorrow's temperature. It's the foundation of all predictive modeling and the first algorithm most ML engineers truly need to understand deeply, because the optimization technique it uses — gradient descent — is the same engine powering neural networks.`,
    },
    {
      header: 'THE INTUITION',
      content: `You have a scatterplot of data. You want to draw the single straight line that comes closest to all the points at once. "Closest" means minimizing the total prediction error across every data point. The question is: how do you find that line automatically? You start with a random line, measure how wrong it is, then nudge the line slightly in the direction that makes it less wrong. Repeat thousands of times. That's gradient descent applied to linear regression.`,
    },
    {
      header: 'HOW THE MATH WORKS — STEP BY STEP',
      content: `The model: ŷ = mx + b, where m is slope and b is intercept. These are the parameters we're learning.

Loss function: Mean Squared Error (MSE) = (1/n) Σ(yᵢ − ŷᵢ)². This measures the average squared gap between our predictions and the actual values. Squaring ensures positive values and penalizes large errors more heavily.

Gradient: The derivative of MSE with respect to m and b tells us which direction to adjust each parameter to increase the loss. We move in the OPPOSITE direction to decrease it.

Update rule:
  m = m − α · (∂MSE/∂m)
  b = b − α · (∂MSE/∂b)

Where α (alpha) is the learning rate — a small number like 0.01 that controls step size. Repeat for many epochs (full passes through the data) until the loss stops meaningfully decreasing.`,
    },
    {
      header: 'REAL WORLD USES',
      content: `Price prediction (real estate, stocks), risk scoring (credit, insurance), forecasting (sales, demand, weather), A/B test analysis, medical dosage modeling. Linear regression is often the baseline every other model has to beat.`,
    },
    {
      header: 'WHAT CAN GO WRONG',
      content: `If the learning rate is too high, gradient descent overshoots the minimum and the loss explodes. Too low and it takes forever. Linear regression assumes the relationship is actually linear — if it's curved, the model systematically under/overfits. It's also sensitive to outliers because squaring errors magnifies them. Feature scaling (normalizing inputs) is often required for gradient descent to converge efficiently.`,
    },
    {
      header: 'CONNECTION TO OTHER ALGORITHMS',
      content: `Logistic regression applies the same approach but swaps the output through a sigmoid function to produce probabilities for classification. Ridge and Lasso regression add penalty terms to prevent overfitting. Neural networks are just many layers of linear transformations followed by non-linear activations — and they also train via gradient descent on a loss function.`,
    },
  ],

  'decision-tree': [
    {
      header: 'WHAT PROBLEM IT SOLVES',
      content: `Decision trees solve both classification (which category?) and regression (what number?) problems by learning a sequence of if/else rules directly from data. They're one of the most interpretable ML models — you can follow the exact logic path from input to output, which makes them valuable in high-stakes domains like medicine and finance where "why did the model decide this?" matters as much as the decision itself.`,
    },
    {
      header: 'THE INTUITION',
      content: `Think of a game of 20 questions. You're trying to identify an animal. You ask the question that eliminates the most possibilities first: "Does it have fur?" Then based on the answer you ask the next best question. You never ask a useless question if a better one exists. A decision tree does exactly this — it searches through all possible questions about your features and greedily picks the one that best separates your data at each step.`,
    },
    {
      header: 'HOW THE MATH WORKS — STEP BY STEP',
      content: `At every node, the algorithm evaluates every possible split across every feature and picks the one that minimizes impurity — how mixed the classes are in each resulting group.

Gini Impurity: Gini = 1 − Σ(pᵢ²), where pᵢ is the proportion of class i in the node. A Gini of 0 means perfectly pure (all one class). A Gini of 0.5 means maximally mixed (50/50 split between two classes).

  Weighted Gini after split = (n_left/n_total) · Gini_left + (n_right/n_total) · Gini_right

The algorithm picks whichever feature and threshold produces the lowest weighted Gini after the split. It then recurses — treating each child node as a new sub-problem — until nodes are pure, a maximum depth is reached, or too few samples remain to split further.`,
    },
    {
      header: 'REAL WORLD USES',
      content: `Medical diagnosis (symptom-based decision paths that doctors can audit), credit scoring (approve/deny loan applications with explainable rules), fraud detection, customer churn prediction, any domain where regulatory compliance requires model transparency.`,
    },
    {
      header: 'WHAT CAN GO WRONG',
      content: `Decision trees are high-variance models — small changes in training data can produce very different trees. They overfit aggressively without depth limits or pruning. They're also biased toward features with many possible split points. A single decision tree is rarely the best model in practice, which is why they're almost always used as building blocks for ensembles.`,
    },
    {
      header: 'CONNECTION TO OTHER ALGORITHMS',
      content: `Random Forest trains hundreds of decision trees on random subsets of data and features, then takes a majority vote — this dramatically reduces variance. Gradient Boosting (XGBoost, LightGBM) trains trees sequentially, with each new tree correcting the errors of the previous one. These ensemble methods are among the most powerful algorithms for structured/tabular data in production today.`,
    },
  ],

  'neural-network': [
    {
      header: 'WHAT PROBLEM IT SOLVES',
      content: `Neural networks learn to approximate any function — mapping inputs to outputs — by composing many simple operations together. They power image recognition, language models, speech synthesis, and recommendation systems. Unlike decision trees or linear regression which assume a fixed functional form, neural networks discover the structure of the mapping themselves from data. Their strength is handling high-dimensional, unstructured data like pixels, audio, and text.`,
    },
    {
      header: 'THE INTUITION',
      content: `Each neuron does something embarrassingly simple: it takes a weighted sum of its inputs and passes the result through an activation function. The magic is in stacking thousands of these neurons across many layers. Early layers learn to detect simple patterns (edges, tones, character shapes). Later layers combine those into complex concepts (faces, words, intentions). No one programs what each neuron should detect — the network figures out the most useful representations on its own through training.`,
    },
    {
      header: 'HOW THE MATH WORKS — FORWARD PASS',
      content: `Each layer computes: output = activation(W · input + b)
Where W is a matrix of weights, b is a bias vector, and activation is a non-linear function applied element-wise.

Without non-linearity (activation functions), stacking layers is pointless — any number of linear transformations is still just one linear transformation. Activation functions like ReLU (max(0, x)) are what allow networks to model non-linear patterns. ReLU fires if the input is positive, stays at zero otherwise — simple but extremely effective.`,
    },
    {
      header: 'HOW THE MATH WORKS — BACKPROPAGATION',
      content: `After the forward pass, we compute a loss — typically cross-entropy for classification or MSE for regression — measuring how wrong the output was.

Backprop uses the chain rule of calculus to compute how much each weight contributed to the error:
  ∂Loss/∂w = ∂Loss/∂output · ∂output/∂w

Working backward through every layer, we compute a gradient for every weight in the network. These gradients tell us the direction to adjust each weight to reduce the loss. Then gradient descent applies the update:
  w = w − α · ∂Loss/∂w

This repeats for thousands of batches across many epochs. Slowly, the weights converge to values that make the network accurate.`,
    },
    {
      header: 'REAL WORLD USES',
      content: `Image classification (what object is in this photo?), natural language processing (translation, summarization, chatbots), speech recognition, drug discovery, generative AI (images, video, music, code). Every major AI product you interact with runs on some form of neural network.`,
    },
    {
      header: 'WHAT CAN GO WRONG',
      content: `Vanishing gradients: in very deep networks, gradients become so small during backprop that early layers barely update. Solved by residual connections (ResNet) and careful initialization. Overfitting: the network memorizes training data. Solved by dropout, regularization, and data augmentation. Training neural networks requires significant data, compute, and careful hyperparameter tuning.`,
    },
    {
      header: 'CONNECTION TO OTHER ALGORITHMS',
      content: `Convolutional Neural Networks (CNNs) add spatial awareness for images. Recurrent Neural Networks (RNNs/LSTMs) handle sequences. Transformers replace recurrence with attention mechanisms and are the architecture behind GPT, BERT, and every modern LLM. All of them train using backpropagation and gradient descent.`,
    },
  ],

  'gradient-descent': [
    {
      header: 'WHAT PROBLEM IT SOLVES',
      content: `Gradient descent is not a standalone ML model — it is the optimization engine that trains almost every model in machine learning. Understanding it at a visual, geometric level is more important than any individual algorithm. If you internalize this one concept, you understand the core mechanic that makes all of modern AI work.`,
    },
    {
      header: 'THE INTUITION',
      content: `Imagine you're blindfolded on a hilly landscape and you want to find the lowest valley. You can't see the whole landscape — you can only feel the slope of the ground right where you're standing. So you take a small step in whatever direction feels most downhill, then reassess. Take another step. Repeat until you're in a valley where every direction is uphill. You've found a local minimum. That's gradient descent. The "landscape" is the loss surface — a geometric shape whose height at every point represents how wrong your model is with those parameters.`,
    },
    {
      header: 'HOW THE MATH WORKS — STEP BY STEP',
      content: `The loss function L(θ) maps your model's parameters θ to a single number — the loss. The gradient ∇L(θ) is a vector pointing in the direction of steepest increase in loss. We move opposite to it:

  θ = θ − α · ∇L(θ)

Where α is the learning rate. Do this repeatedly and θ slides downhill across the loss surface toward a minimum. In linear regression, the surface is a convex bowl — there's one global minimum and gradient descent always finds it. In neural networks, the surface is a high-dimensional, wildly non-convex landscape full of local minima, saddle points, and flat plateaus.

Variants:
  Batch GD: compute gradient using the full dataset. Stable but slow.
  Stochastic GD (SGD): compute gradient using one sample. Fast but noisy.
  Mini-batch GD: use a small batch (32–256 samples). Best of both — most commonly used in practice.
  Momentum: accumulate a velocity vector that keeps moving in consistent directions, damping oscillations across ravines.
  Adam: adaptive learning rates per parameter + momentum. The default optimizer for most neural networks today.`,
    },
    {
      header: 'REAL WORLD USES',
      content: `Training every neural network ever deployed. Fine-tuning large language models. Learning word embeddings. Optimizing recommendation systems. Anywhere a model has parameters and a differentiable loss function — which is almost everywhere.`,
    },
    {
      header: 'WHAT CAN GO WRONG',
      content: `Learning rate too high: divergence — loss bounces around or explodes.
Learning rate too low: training takes impractically long or gets stuck.
Saddle points: regions where the gradient is zero but it's not a minimum — common in high-dimensional spaces, less problematic than once feared.
Poor initialization: starting in a bad region of the loss surface leads to bad local minima.
Learning rate schedules (decay over time) and adaptive optimizers like Adam address most of these in practice.`,
    },
    {
      header: 'CONNECTION TO OTHER ALGORITHMS',
      content: `Gradient descent is the common thread connecting linear regression, logistic regression, SVMs (in their dual form), and all neural networks. When you see the word "training" in ML, you are almost always looking at gradient descent running on a loss function. Understanding this visualization makes every other algorithm's training process suddenly legible.`,
    },
  ],
}
