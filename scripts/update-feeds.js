const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');

const parser = new Parser({
    customFields: {
        item: ['description', 'content:encoded', 'pubDate', 'creator', 'dc:creator']
    },
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0; +https://synthetici.com)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
            'Cache-Control': 'no-cache',
        },
        timeout: 15000 // 15 seconds timeout
    }
});

// Utility function for delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if we should skip fetching based on last update time
function shouldSkipUpdate(lastUpdated, hoursThreshold = 6) {
    if (!lastUpdated) return false;
    
    const lastUpdate = new Date(lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    return hoursSinceUpdate < hoursThreshold;
}

// Get cache file path for storing request metadata
function getCacheFilePath(feedName) {
    return path.join(__dirname, '..', 'data', 'feeds', `.${feedName}-cache.json`);
}

// Load cache metadata
async function loadCacheMetadata(feedName) {
    try {
        const cacheFile = getCacheFilePath(feedName);
        const data = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { lastFetch: null, etag: null, lastModified: null };
    }
}

// Save cache metadata
async function saveCacheMetadata(feedName, metadata) {
    try {
        const cacheFile = getCacheFilePath(feedName);
        await fs.writeFile(cacheFile, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
        console.log(`Warning: Could not save cache metadata for ${feedName}`);
    }
}

// Conservative retry function with longer delays
async function retryWithBackoff(fn, maxRetries = 2, baseDelay = 10000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`Attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Much longer exponential backoff: 10s, 30s
            const delayTime = baseDelay + (baseDelay * 2 * (attempt - 1));
            console.log(`Waiting ${delayTime}ms before retry...`);
            await delay(delayTime);
        }
    }
}

// Circuit breaker functionality
async function getCircuitBreakerState(feedName) {
    try {
        const circuitFile = path.join(__dirname, '..', 'data', 'feeds', `.${feedName}-circuit.json`);
        const data = await fs.readFile(circuitFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { failures: 0, lastFailure: null, isOpen: false };
    }
}

async function updateCircuitBreakerState(feedName, success = true) {
    try {
        const circuitFile = path.join(__dirname, '..', 'data', 'feeds', `.${feedName}-circuit.json`);
        let state = await getCircuitBreakerState(feedName);
        
        if (success) {
            // Reset on success
            state = { failures: 0, lastFailure: null, isOpen: false };
        } else {
            // Increment failure count
            state.failures += 1;
            state.lastFailure = new Date().toISOString();
            
            // Open circuit if too many failures (5 failures)
            if (state.failures >= 5) {
                state.isOpen = true;
            }
        }
        
        await fs.writeFile(circuitFile, JSON.stringify(state, null, 2), 'utf8');
        return state;
    } catch (error) {
        console.log(`Warning: Could not update circuit breaker state for ${feedName}`);
        return { failures: 0, lastFailure: null, isOpen: false };
    }
}

async function shouldSkipDueToCircuitBreaker(feedName) {
    const state = await getCircuitBreakerState(feedName);
    
    if (!state.isOpen) return false;
    
    // Check if circuit should be half-open (try again after 24 hours)
    if (state.lastFailure) {
        const lastFailure = new Date(state.lastFailure);
        const now = new Date();
        const hoursSinceFailure = (now - lastFailure) / (1000 * 60 * 60);
        
        if (hoursSinceFailure >= 24) {
            console.log(`${feedName}: Circuit breaker half-open, attempting fetch`);
            return false;
        }
    }
    
    console.log(`${feedName}: Circuit breaker OPEN, skipping fetch`);
    return true;
}

async function fetchMediumFeed() {
    try {
        console.log('Checking Medium feed...');
        
        // Load existing data first
        let existingData = null;
        try {
            const existingPath = path.join(__dirname, '..', 'data', 'feeds', 'medium.json');
            const existing = await fs.readFile(existingPath, 'utf8');
            existingData = JSON.parse(existing);
        } catch (error) {
            console.log('No existing Medium data found');
        }
        
        // Check if we should skip based on recent update
        if (existingData && shouldSkipUpdate(existingData.lastUpdated, 4)) {
            console.log('Medium feed recently updated, using cached data');
            return existingData;
        }
        
        // Load cache metadata
        const cacheMetadata = await loadCacheMetadata('medium');
        
        // Check circuit breaker state
        const circuitState = await getCircuitBreakerState('medium');
        if (circuitState.isOpen) {
            console.log('Medium feed circuit breaker is open, skipping fetch');
            return existingData || null;
        }
        
        console.log('Fetching fresh Medium feed...');
        
        const feed = await retryWithBackoff(async () => {
            // Add a longer initial delay for Medium (they're very strict)
            await delay(3000);
            return await parser.parseURL('https://medium.com/feed/@thegoodprogrammer');
        }, 2, 15000); // Only 2 retries with 15s base delay
        
        // Save successful fetch metadata
        await saveCacheMetadata('medium', {
            lastFetch: new Date().toISOString(),
            etag: null,
            lastModified: null
        });
        
        // Update circuit breaker state on success
        await updateCircuitBreakerState('medium', true);
        
        const posts = feed.items.slice(0, 20).map(item => {
            // Extract excerpt from description or content
            let excerpt = '';
            const content = item['content:encoded'] || item.description || '';
            if (content) {
                // Remove HTML tags and get first 150 characters
                excerpt = content.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
            }
            
            // Extract image URL from content
            let imageUrl = '';
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
                imageUrl = imgMatch[1];
            }
            
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description,
                excerpt: excerpt,
                image: imageUrl,
                creator: item.creator || item['dc:creator'] || 'The Good Programmer'
            };
        });
        
        console.log(`Successfully fetched ${posts.length} Medium posts`);
        return {
            title: feed.title,
            description: feed.description,
            link: feed.link,
            lastUpdated: new Date().toISOString(),
            posts: posts
        };
        
    } catch (error) {
        console.error('Error fetching Medium feed:', error);
        
        // Update circuit breaker state on failure
        await updateCircuitBreakerState('medium', false);
        
        // Return existing data if available
        if (existingData) {
            console.log('Returning existing Medium data due to fetch error');
            return existingData;
        }
        
        throw error;
    }
}

async function fetchSubstackFeed() {
    try {
        console.log('Checking Substack feed...');
        
        // Load existing data first
        let existingData = null;
        try {
            const existingPath = path.join(__dirname, '..', 'data', 'feeds', 'substack.json');
            const existing = await fs.readFile(existingPath, 'utf8');
            existingData = JSON.parse(existing);
        } catch (error) {
            console.log('No existing Substack data found');
        }
        
        // Check if we should skip based on recent update
        if (existingData && shouldSkipUpdate(existingData.lastUpdated, 4)) {
            console.log('Substack feed recently updated, using cached data');
            return existingData;
        }
        
        // Check circuit breaker state
        const circuitState = await getCircuitBreakerState('substack');
        if (circuitState.isOpen) {
            console.log('Substack feed circuit breaker is open, skipping fetch');
            return existingData || null;
        }
        
        console.log('Fetching fresh Substack feed...');
        
        const feed = await retryWithBackoff(async () => {
            return await parser.parseURL('https://bematic.substack.com/feed');
        }, 2, 8000); // 2 retries with 8s base delay
        
        const posts = feed.items.slice(0, 20).map(item => {
            // Extract excerpt from description or content
            let excerpt = '';
            const content = item['content:encoded'] || item.description || '';
            if (content) {
                // Remove HTML tags and get first 150 characters
                excerpt = content.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
            }
            
            // Extract image URL from content
            let imageUrl = '';
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
                imageUrl = imgMatch[1];
            }
            
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description,
                excerpt: excerpt,
                image: imageUrl,
                creator: item.creator || item['dc:creator'] || 'Bematic'
            };
        });
        
        console.log(`Successfully fetched ${posts.length} Substack posts`);
        return {
            title: feed.title,
            description: feed.description,
            link: feed.link,
            lastUpdated: new Date().toISOString(),
            posts: posts
        };
        
    } catch (error) {
        console.error('Error fetching Substack feed:', error);
        
        // Update circuit breaker state on failure
        await updateCircuitBreakerState('substack', false);
        
        // Return existing data if available
        if (existingData) {
            console.log('Returning existing Substack data due to fetch error');
            return existingData;
        }
        
        throw error;
    }
}

async function saveJsonFile(filename, data) {
    const dataDir = path.join(__dirname, '..', 'data', 'feeds');
    await fs.mkdir(dataDir, { recursive: true });
    
    const filePath = path.join(dataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved ${filename}`);
}

async function main() {
    try {
        console.log('Starting RSS feed update process...');
        
        let mediumData = null;
        let substackData = null;
        
        // Implement staggered updates - alternate between sources
        const now = new Date();
        const hourOfDay = now.getHours();
        const updateMedium = hourOfDay % 16 < 8; // Update Medium every 16 hours, offset by 8
        const updateSubstack = hourOfDay % 16 >= 8; // Update Substack every 16 hours, offset
        
        console.log(`Update strategy: Medium=${updateMedium}, Substack=${updateSubstack}`);
        
        // Try to fetch Medium feed with enhanced error handling
        try {
            if (updateMedium) {
                mediumData = await fetchMediumFeed();
                await saveJsonFile('medium.json', mediumData);
            } else {
                // Load existing Medium data
                try {
                    const existingMediumPath = path.join(__dirname, '..', 'data', 'feeds', 'medium.json');
                    const existingMedium = await fs.readFile(existingMediumPath, 'utf8');
                    mediumData = JSON.parse(existingMedium);
                    console.log('Using existing Medium data (staggered update)');
                } catch (fallbackError) {
                    console.log('No existing Medium data, attempting fetch anyway');
                    mediumData = await fetchMediumFeed();
                    await saveJsonFile('medium.json', mediumData);
                }
            }
        } catch (error) {
            console.error('Failed to fetch Medium feed after all retries:', error.message);
            
            // Try to load existing Medium data as fallback
            try {
                const existingMediumPath = path.join(__dirname, '..', 'data', 'feeds', 'medium.json');
                const existingMedium = await fs.readFile(existingMediumPath, 'utf8');
                mediumData = JSON.parse(existingMedium);
                console.log('Using existing Medium data as fallback');
            } catch (fallbackError) {
                console.error('No existing Medium data available:', fallbackError.message);
                // Create minimal fallback data
                mediumData = {
                    title: "Stories by The Good Programmer on Medium",
                    description: "Stories by The Good Programmer on Medium",
                    link: "https://medium.com/@thegoodprogrammer",
                    lastUpdated: new Date().toISOString(),
                    posts: []
                };
            }
        }
        
        // Wait much longer between feed fetches to avoid rate limiting
        console.log('Waiting 30 seconds before fetching Substack feed...');
        await delay(30000);
        
        // Try to fetch Substack feed with enhanced error handling
        try {
            if (updateSubstack) {
                substackData = await fetchSubstackFeed();
                await saveJsonFile('substack.json', substackData);
            } else {
                // Load existing Substack data
                try {
                    const existingSubstackPath = path.join(__dirname, '..', 'data', 'feeds', 'substack.json');
                    const existingSubstack = await fs.readFile(existingSubstackPath, 'utf8');
                    substackData = JSON.parse(existingSubstack);
                    console.log('Using existing Substack data (staggered update)');
                } catch (fallbackError) {
                    console.log('No existing Substack data, attempting fetch anyway');
                    substackData = await fetchSubstackFeed();
                    await saveJsonFile('substack.json', substackData);
                }
            }
        } catch (error) {
            console.error('Failed to fetch Substack feed after all retries:', error.message);
            
            // Try to load existing Substack data as fallback
            try {
                const existingSubstackPath = path.join(__dirname, '..', 'data', 'feeds', 'substack.json');
                const existingSubstack = await fs.readFile(existingSubstackPath, 'utf8');
                substackData = JSON.parse(existingSubstack);
                console.log('Using existing Substack data as fallback');
            } catch (fallbackError) {
                console.error('No existing Substack data available:', fallbackError.message);
                // Create minimal fallback data
                substackData = {
                    title: "Lorenzo Toscano",
                    description: "AI expert writing on AI and software engineering automation",
                    link: "https://bematic.substack.com",
                    lastUpdated: new Date().toISOString(),
                    posts: []
                };
            }
        }
        
        // Create combined feed metadata
        const metadata = {
            lastUpdated: new Date().toISOString(),
            sources: {
                medium: {
                    title: mediumData.title,
                    postCount: mediumData.posts.length,
                    lastUpdated: mediumData.lastUpdated
                },
                substack: {
                    title: substackData.title,
                    postCount: substackData.posts.length,
                    lastUpdated: substackData.lastUpdated
                }
            }
        };
        
        await saveJsonFile('metadata.json', metadata);
        
        console.log('RSS feed update completed successfully!');
        console.log(`Medium posts: ${mediumData.posts.length}`);
        console.log(`Substack posts: ${substackData.posts.length}`);
        
    } catch (error) {
        console.error('Critical error in main process:', error);
        // Don't exit with error code if we managed to get some data
        console.log('Process completed with some errors, but data may have been updated');
    }
}

// Run the script
main();
