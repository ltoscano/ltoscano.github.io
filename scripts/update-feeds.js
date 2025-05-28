const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');

const parser = new Parser({
    customFields: {
        item: ['description', 'content:encoded', 'pubDate', 'creator', 'dc:creator']
    }
});

async function fetchMediumFeed() {
    try {
        console.log('Fetching Medium feed...');
        const feed = await parser.parseURL('https://medium.com/feed/@thegoodprogrammer');
        
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
        throw error;
    }
}

async function fetchSubstackFeed() {
    try {
        console.log('Fetching Substack feed...');
        const feed = await parser.parseURL('https://bematic.substack.com/feed');
        
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
        
        // Fetch Medium feed
        const mediumData = await fetchMediumFeed();
        await saveJsonFile('medium.json', mediumData);
        
        // Fetch Substack feed
        const substackData = await fetchSubstackFeed();
        await saveJsonFile('substack.json', substackData);
        
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
        
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// Run the script
main();
