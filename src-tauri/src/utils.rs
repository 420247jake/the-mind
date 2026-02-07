/// Extract keywords from text (simple word extraction, filtering stopwords)
pub fn extract_keywords(text: &str) -> Vec<String> {
    let stopwords = [
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "shall", "can", "need", "dare",
        "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
        "into", "through", "during", "before", "after", "above", "below",
        "between", "under", "again", "further", "then", "once", "and", "but",
        "or", "nor", "so", "yet", "both", "either", "neither", "not", "only",
        "own", "same", "than", "too", "very", "just", "also", "now", "here",
        "there", "when", "where", "why", "how", "all", "each", "every", "any",
        "few", "more", "most", "other", "some", "such", "no", "none", "this",
        "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        "what", "which", "who", "whom", "this", "that", "am", "about", "up",
    ];

    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|word| word.len() >= 3)
        .filter(|word| !stopwords.contains(word))
        .map(|s| s.to_string())
        .collect()
}

/// Count shared keywords between two keyword lists
pub fn count_shared_keywords(keywords1: &[String], keywords2: &[String]) -> usize {
    keywords1.iter()
        .filter(|k| keywords2.contains(k))
        .count()
}
