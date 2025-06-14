import React, { useState, useEffect, useRef, useCallback } from 'react';

// Main App component
const App = () => {
    // State to store the input YouTube URLs
    const [youtubeUrlsInput, setYoutubeUrlsInput] = useState('');
    // State to store the list of video objects (id, position, size, zIndex)
    const [videos, setVideos] = useState([]);
    // State to manage the next available ID for new videos
    const [nextId, setNextId] = useState(0); 
    // Ref for the main container to determine bounds for dragging/resizing
    const containerRef = useRef(null);
    // State to track the currently dragged/resized item (individual video)
    const [activeVideoIndex, setActiveVideoIndex] = useState(null);
    // State to track mouse/touch position when drag/resize starts
    const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
    // State to store initial video size/position when drag/resize starts
    const [startVideoRect, setStartVideoRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
    // State to indicate if we are in resize mode (individual video)
    const [isResizing, setIsResizing] = useState(false);
    // State to indicate if we are in drag mode (individual video)
    const [isDragging, setIsDragging] = useState(false);
    // State to track the active resize handle (e.g., 'se', 's', 'e') for individual video
    const [activeHandle, setActiveHandle] = useState(null);
    const [autoplayEnabled, setAutoplayEnabled] = useState(false);

    // New state for controlling the height of the main video container
    const [mainContainerHeight, setMainContainerHeight] = useState(600); // Initial height

    // State for resizing the main container
    const [isMainContainerResizing, setIsMainContainerResizing] = useState(false);
    const [mainContainerStartHeight, setMainContainerStartHeight] = useState(0);
    const [mainContainerStartMouseY, setMainContainerStartMouseY] = useState(0);


    // Define a padding around the video content for dragging, but not for resizing
    const DRAG_PADDING = 30; // Increased padding for easier dragging (2x the previous 15)

    // Function to extract YouTube video ID from various URL formats
    const getYoutubeVideoId = (url) => {
        const match = url.match(/(?:v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    // Synchronize videos state with youtubeUrlsInput
    useEffect(() => {
        const idsFromInput = youtubeUrlsInput
            .split('\n')
            .map(url => getYoutubeVideoId(url.trim()))
            .filter(Boolean);
        const uniqueIds = [...new Set(idsFromInput)];

        setVideos(currentVideos => {
            const finalVideos = uniqueIds.map(id => {
                const existingVideo = currentVideos.find(v => v.id === id);
                if (existingVideo) {
                    return existingVideo; // Preserve existing video state
                }
                return null; // Placeholder for new videos
            });

            let nextAvailableId = nextId;
            const newVideosCreated = [];

            // Create new videos for the null placeholders
            const resultVideos = finalVideos.map((video, index) => {
                if (video) {
                    return video;
                }

                const videoId = uniqueIds[index];
                const containerWidth = containerRef.current ? containerRef.current.offsetWidth : 1200;
                const containerHeight = mainContainerHeight;
                const defaultWidth = 400;
                const defaultHeight = 225;
                
                // Calculate position based on the number of videos already processed
                const numExisting = finalVideos.filter(v => v !== null).length + newVideosCreated.length;
                const x = (numExisting * 50) % (containerWidth - defaultWidth - 50);
                const y = (numExisting * 50) % (containerHeight - defaultHeight - 50);
                
                const currentMaxZIndex = currentVideos.reduce((max, v) => Math.max(max, v.zIndex || 0), 0);

                const newVideo = {
                    id: videoId,
                    key: nextAvailableId,
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: defaultWidth,
                    height: defaultHeight,
                    zIndex: currentMaxZIndex + 1,
                };
                nextAvailableId++;
                newVideosCreated.push(newVideo);
                return newVideo;
            });

            if (nextAvailableId > nextId) {
                setNextId(nextAvailableId);
            }

            // Avoid re-render if nothing has changed
            if (resultVideos.length === currentVideos.length && resultVideos.every((v, i) => v.key === currentVideos[i]?.key)) {
                return currentVideos;
            }

            return resultVideos;
        });
    }, [youtubeUrlsInput, mainContainerHeight, nextId]);


    // Mouse/Touch down handler for dragging individual video
    const handleVideoMouseDown = useCallback((index, e) => {
        // Safely get clientX and clientY for both mouse and touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Only start drag if it's not a resize handle and not already resizing/dragging
        // And also not resizing the main container
        if (e.target.classList.contains('resize-handle') || isResizing || isDragging || isMainContainerResizing) {
            return;
        }

        e.preventDefault(); // Prevent default browser drag behavior (e.g., text selection)

        const videoElement = e.currentTarget; // The drag handle div itself
        const parentVideoItem = videoElement.closest('.resizable-item'); // Get the main video wrapper div
        const containerRect = containerRef.current.getBoundingClientRect();
        const videoRect = parentVideoItem.getBoundingClientRect();

        setActiveVideoIndex(index);
        setIsDragging(true);
        setStartMousePos({ x: clientX, y: clientY });
        setStartVideoRect({
            x: videoRect.left - containerRect.left,
            y: videoRect.top - containerRect.top,
            width: videoRect.width,
            height: videoRect.height
        });

        // Bring the dragged item to the front by updating its zIndex
        setVideos(prevVideos => {
            const maxZIndex = prevVideos.reduce((max, v) => Math.max(max, v.zIndex || 0), 0);
            const newVideos = prevVideos.map((v, i) =>
                i === index ? { ...v, zIndex: maxZIndex + 1 } : { ...v } // Keep others' zIndex as is
            );
            return newVideos;
        });
    }, [isResizing, isDragging, isMainContainerResizing]);


    // Mouse/Touch down handler for resizing individual video
    const handleResizeMouseDown = useCallback((index, handle, e) => {
        // Safely get clientX and clientY for both mouse and touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        e.stopPropagation(); // Prevent drag from starting on the parent div
        e.preventDefault(); // Prevent default browser behavior (e.g., text selection)

        // Find the closest parent with 'resizable-item' class
        const videoElement = e.currentTarget.closest('.resizable-item');
        const containerRect = containerRef.current.getBoundingClientRect();
        const videoRect = videoElement.getBoundingClientRect();

        setActiveVideoIndex(index);
        setIsResizing(true);
        setActiveHandle(handle);
        setStartMousePos({ x: clientX, y: clientY });
        setStartVideoRect({
            x: videoRect.left - containerRect.left,
            y: videoRect.top - containerRect.top,
            width: videoRect.width,
            height: videoRect.height
        });

        // Bring the resized item to the front by updating its zIndex
        setVideos(prevVideos => {
            const maxZIndex = prevVideos.reduce((max, v) => Math.max(max, v.zIndex || 0), 0);
            const newVideos = prevVideos.map((v, i) =>
                i === index ? { ...v, zIndex: maxZIndex + 1 } : { ...v } // Keep others' zIndex as is
            );
            return newVideos;
        });
    }, []);


    // Mouse/Touch move handler for dragging and resizing individual video or main container
    const handleMouseMove = useCallback((e) => {
        // Safely get clientX and clientY for both mouse and touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isMainContainerResizing) {
            const deltaY = clientY - mainContainerStartMouseY;
            let newHeight = mainContainerStartHeight + deltaY;
            // Define minimum height for the main container
            newHeight = Math.max(300, newHeight);
            setMainContainerHeight(newHeight);
            return; // Stop if resizing main container
        }


        if (activeVideoIndex === null) return; // If not resizing main container, check individual videos

        const containerRect = containerRef.current.getBoundingClientRect();
        const deltaX = clientX - startMousePos.x;
        const deltaY = clientY - startMousePos.y;

        setVideos(prevVideos => {
            const currentVideo = { ...prevVideos[activeVideoIndex] };

            if (isDragging) {
                let newX = startVideoRect.x + deltaX;
                let newY = startVideoRect.y + deltaY;

                // Clamp position within container boundaries
                newX = Math.max(0, Math.min(newX, containerRect.width - currentVideo.width));
                newY = Math.max(0, Math.min(newY, containerRect.height - currentVideo.height));

                currentVideo.x = newX;
                currentVideo.y = newY;
            } else if (isResizing && activeHandle) {
                let newX = startVideoRect.x;
                let newY = startVideoRect.y;
                let newWidth = startVideoRect.width;
                let newHeight = startVideoRect.height;

                const minWidth = 200;
                const minHeight = 112; // 16:9 aspect ratio for minWidth
                const aspectRatio = 16 / 9;

                // Calculate proposed width/height based on mouse movement
                let proposedWidth = startVideoRect.width;
                let proposedHeight = startVideoRect.height;

                if (activeHandle.includes('e')) proposedWidth = startVideoRect.width + deltaX;
                if (activeHandle.includes('w')) proposedWidth = startVideoRect.width - deltaX;
                if (activeHandle.includes('s')) proposedHeight = startVideoRect.height + deltaY;
                if (activeHandle.includes('n')) proposedHeight = startVideoRect.height - deltaY;

                // Apply min constraints
                proposedWidth = Math.max(minWidth, proposedWidth);
                proposedHeight = Math.max(minHeight, proposedHeight);

                // Apply aspect ratio
                // Prioritize width for aspect ratio if horizontal resize is primary or it's a corner handle
                if (activeHandle.includes('e') || activeHandle.includes('w') || (activeHandle.length === 2 && !activeHandle.includes('n') && !activeHandle.includes('s')) ) {
                    proposedHeight = Math.round(proposedWidth / aspectRatio);
                    if (proposedHeight < minHeight) {
                        proposedHeight = minHeight;
                        proposedWidth = Math.round(proposedHeight * aspectRatio);
                    }
                } else if (activeHandle.includes('s') || activeHandle.includes('n')) { // Prioritize height change
                    proposedWidth = Math.round(proposedHeight * aspectRatio);
                    if (proposedWidth < minWidth) {
                        proposedWidth = minWidth;
                        proposedHeight = Math.round(proposedWidth / aspectRatio);
                    }
                }

                // Final new width and height based on all adjustments
                newWidth = proposedWidth;
                newHeight = proposedHeight;

                // Calculate new X and Y based on adjusted dimensions for left/top handles
                // This ensures the right/bottom edge remains anchored when resizing from left/top
                if (activeHandle.includes('w')) {
                    newX = startVideoRect.x + (startVideoRect.width - newWidth);
                } else {
                    newX = startVideoRect.x;
                }

                if (activeHandle.includes('n')) {
                    newY = startVideoRect.y + (startVideoRect.height - newHeight);
                } else {
                    newY = startVideoRect.y;
                }

                // Clamp to container bounds (position and size)
                // First, clamp position to ensure it doesn't go off left/top edge
                newX = Math.max(0, newX);
                newY = Math.max(0, newY);

                // Then, clamp width/height to ensure right/bottom edge stays within container
                newWidth = Math.min(newWidth, containerRect.width - newX);
                newHeight = Math.min(newHeight, containerRect.height - newY);

                // Finally, adjust X/Y if clamping width/height caused it to extend past left/top
                // This is important if `newWidth` was clamped because `containerRect.width - newX` was hit.
                // In such a case, for `w` handles, `newX` might need to be adjusted back.
                if (activeHandle.includes('w')) {
                    newX = Math.min(newX, containerRect.width - newWidth);
                }
                if (activeHandle.includes('n')) {
                    newY = Math.min(newY, containerRect.height - newHeight);
                }

                // Update currentVideo properties
                currentVideo.width = newWidth;
                currentVideo.height = newHeight;
                currentVideo.x = newX;
                currentVideo.y = newY;
            }

            const newVideos = [...prevVideos];
            newVideos[activeVideoIndex] = currentVideo;
            return newVideos;
        });
    }, [activeVideoIndex, isDragging, isResizing, activeHandle, startMousePos, startVideoRect, isMainContainerResizing, mainContainerStartHeight, mainContainerStartMouseY]);

    // Mouse/Touch up handler to stop dragging/resizing
    const handleMouseUp = useCallback(() => {
        setActiveVideoIndex(null);
        setIsDragging(false);
        setIsResizing(false);
        setActiveHandle(null);
        setIsMainContainerResizing(false); // Stop main container resizing
    }, []);

    // Add global event listeners for mouse and touch events
    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        // Add touch event listeners for mobile devices
        window.addEventListener('touchmove', handleMouseMove, { passive: false }); // passive: false to allow preventDefault
        window.addEventListener('touchend', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    // Handle removing a video
    // removeVideo now only needs to modify the input string. The useEffect will handle the rest.
    const removeVideo = (keyToRemove) => {
        const videoToRemove = videos.find(video => video.key === keyToRemove);
        if (videoToRemove) {
            setYoutubeUrlsInput(prevInput =>
                prevInput.split('\n')
                         .filter(url => url.trim() && !url.includes(videoToRemove.id))
                         .join('\n')
            );
        }
    };

    // Handle clearing all URLs and videos
    const clearAll = () => {
        setYoutubeUrlsInput('');
        setVideos([]);
        setNextId(0);
    };

    // Function to arrange windows in a grid layout
    const arrangeWindows = useCallback(() => {
        if (!containerRef.current || videos.length === 0) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = mainContainerHeight; // Use the current main container height for arrangement
        const spacing = 15; // Padding between videos and container edges

        const numVideos = videos.length;
        // Determine number of columns based on a roughly square grid approach
        const numCols = Math.ceil(Math.sqrt(numVideos));
        const numRows = Math.ceil(numVideos / numCols);

        // Calculate the maximum available width and height for a video cell, including internal spacing
        // We divide the *total available space* by the number of columns/rows to get the 'cell size'.
        // The actual video size will then be derived from this cell size.
        const totalHorizontalSpacing = spacing * (numCols + 1);
        const totalVerticalSpacing = spacing * (numRows + 1);

        const availableWidthForVideos = containerWidth - totalHorizontalSpacing;
        const availableHeightForVideos = containerHeight - totalVerticalSpacing;

        const cellWidth = availableWidthForVideos / numCols;
        const cellHeight = availableHeightForVideos / numRows;

        const aspectRatio = 16 / 9; // Standard YouTube aspect ratio

        let finalVideoWidth, finalVideoHeight;

        // Determine the video dimensions to maximize fill while maintaining aspect ratio within each cell
        // We want the largest video that fits within the cell (cellWidth x cellHeight)
        const videoHeightIfWidthIsMax = cellWidth / aspectRatio;
        const videoWidthIfHeightIsMax = cellHeight * aspectRatio;

        if (videoHeightIfWidthIsMax <= cellHeight) {
            // If scaling by width fits within cell's height, use that
            finalVideoWidth = cellWidth;
            finalVideoHeight = videoHeightIfWidthIsMax;
        } else {
            // Otherwise, scale by height to fit, and adjust width
            finalVideoWidth = videoWidthIfHeightIsMax;
            finalVideoHeight = cellHeight;
        }

        // Round to nearest integer for pixel precision
        finalVideoWidth = Math.floor(finalVideoWidth);
        finalVideoHeight = Math.floor(finalVideoHeight);

        // Ensure dimensions meet minimums
        finalVideoWidth = Math.max(200, finalVideoWidth);
        finalVideoHeight = Math.max(112, finalVideoHeight);

        const newArrangedVideos = videos.map((video, index) => {
            const row = Math.floor(index / numCols);
            const col = index % numCols;

            // Calculate the top-left position for this video
            // Add initial spacing, then add (column_index * (video_width + spacing))
            const x = spacing + col * (finalVideoWidth + spacing);
            const y = spacing + row * (finalVideoHeight + spacing);

            return {
                ...video,
                x: Math.round(x),
                y: Math.round(y),
                width: finalVideoWidth,
                height: finalVideoHeight,
                zIndex: 1 // Reset zIndex for arranged view
            };
        });

        setVideos(newArrangedVideos);
    }, [videos.length, mainContainerHeight]); // mainContainerHeight added to dependency array for arrangement

    // Handle mouse down for resizing the main container
    const handleMainContainerResizeMouseDown = useCallback((e) => {
        // Safely get clientY for both mouse and touch events
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (isDragging || isResizing) return; // Prevent main container resize if individual video is being manipulated

        e.preventDefault();
        setIsMainContainerResizing(true);
        setMainContainerStartHeight(containerRef.current.offsetHeight);
        setMainContainerStartMouseY(clientY);
    }, [isDragging, isResizing]);


    return (
        // Outermost div uses flex-col to stack children vertically and min-h-screen to take full viewport height
        <div className="min-h-screen bg-gray-900 text-white font-inter p-6 flex flex-col items-center">
            {/* Tailwind CSS CDN is assumed to be in public/index.html */}
            {/* Inter font from Google Fonts is assumed to be in public/index.html */}

            <h1 className="text-4xl font-bold text-blue-400 mb-6 rounded-lg p-2">Multi-YouTube Live Feed Viewer</h1>
            <p className="text-gray-300 mb-8 text-center max-w-2xl">
                Enter YouTube video URLs (one per line). Drag and resize the videos to arrange your custom CCTV dashboard!
            </p>

            {/* Input Section */}
            <div className="w-full max-w-xl bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
                <h2 className="text-2xl font-semibold text-gray-200 mb-4">1. Enter YouTube URLs</h2>
                <textarea
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                    rows="6"
                    placeholder="Example:
https://www.youtube.com/watch?v=your_video_id_1
https://youtu.be/your_video_id_2"
                    value={youtubeUrlsInput}
                    onChange={(e) => setYoutubeUrlsInput(e.target.value)}
                ></textarea>
                <div className="flex items-center my-4">
                    <input
                        id="autoplay-checkbox"
                        type="checkbox"
                        checked={autoplayEnabled}
                        onChange={() => setAutoplayEnabled(!autoplayEnabled)}
                        className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="autoplay-checkbox" className="ml-2 text-gray-300">
                        Autoplay videos
                    </label>
                </div>
                <div className="flex space-x-4 mt-4">
                    <button
                        onClick={clearAll}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Clear All Videos
                    </button>
                    <button
                        onClick={arrangeWindows}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Arrange Windows
                    </button>
                </div>
            </div>

            {/* Video Display Section - now dynamically resizable */}
            <h2 className="text-2xl font-semibold text-gray-200 mb-6">2. Your Live Feeds</h2>
            <div
                ref={containerRef}
                className="relative w-full bg-gray-800 rounded-xl shadow-lg p-4 mb-8 touch-none flex-grow" // flex-grow makes it take remaining vertical space
                style={{
                    height: mainContainerHeight, // Controlled by state for user resizing
                    cursor: (isDragging || isMainContainerResizing) ? 'grabbing' : (isResizing ? `${activeHandle}-resize` : 'auto')
                }}
            >
                {videos.length === 0 && (
                    <p className="text-center text-gray-400 text-lg absolute inset-0 flex items-center justify-center">
                        Paste YouTube video URLs into the text area above to see your feeds here.
                    </p>
                )}
                {videos.map((video, index) => (
                    <div
                        key={video.key}
                        className="absolute resizable-item"
                        style={{
                            left: video.x,
                            top: video.y,
                            width: video.width,
                            height: video.height,
                            zIndex: video.zIndex,
                            cursor: 'grab',
                            backgroundColor: '#374151',
                            borderRadius: '0.5rem',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            border: '2px solid #3b82f6',
                            overflow: 'hidden',
                        }}
                    >
                        <div className="relative w-full h-full">
                            {/* Drag handle area - now restricted to the top */}
                            <div
                                className="absolute top-0 left-0 w-full"
                                style={{ height: '30px', cursor: 'grab', zIndex: 51 }}
                                onMouseDown={(e) => handleVideoMouseDown(index, e)}
                                onTouchStart={(e) => handleVideoMouseDown(index, e)}
                            ></div>

                            {/* Close button for the video */}
                            <button
                                onClick={() => removeVideo(video.key)}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white text-xs p-1 rounded-full w-6 h-6 flex items-center justify-center shadow-md transition-transform transform hover:scale-110"
                                style={{ zIndex: 52 }}
                                title="Remove video"
                            >
                                &times;
                            </button>
                            {/* YouTube iframe */}
                            <iframe
                                src={`https://www.youtube.com/embed/${video.id}?autoplay=${autoplayEnabled ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full rounded-md"
                                style={{ pointerEvents: isDragging || isResizing ? 'none' : 'auto' }}
                                title={`YouTube Video Player - ${video.id}`}
                            ></iframe>
                        </div>
                        {/* Resize Handles */}
                        {['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map(handle => (
                            <div
                                key={handle}
                                className={`resize-handle resize-handle-${handle}`}
                                style={{
                                    position: 'absolute',
                                    background: 'transparent',
                                    zIndex: 60,
                                    cursor: `${handle}-resize`,
                                    ...(handle.includes('n') && { top: -10, height: 20 }),
                                    ...(handle.includes('s') && { bottom: -10, height: 20 }),
                                    ...(handle.includes('w') && { left: -10, width: 20 }),
                                    ...(handle.includes('e') && { right: -10, width: 20 }),
                                    ...((handle === 'n' || handle === 's') && { left: '10%', width: '80%' }),
                                    ...((handle === 'e' || handle === 'w') && { top: '10%', height: '80%' }),
                                    ...(handle.length === 2 && { width: 30, height: 30 })
                                }}
                                onMouseDown={(e) => handleResizeMouseDown(index, handle, e)}
                                onTouchStart={(e) => handleResizeMouseDown(index, handle, e.touches[0])}
                            />
                        ))}
                    </div>
                ))}
                {/* Main Container Resize Handle (top center) */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-blue-700 hover:bg-blue-600 rounded-t-lg cursor-ns-resize flex items-center justify-center"
                    style={{ zIndex: 70 }} // Higher z-index to be on top
                    onMouseDown={handleMainContainerResizeMouseDown}
                    onTouchStart={handleMainContainerResizeMouseDown}
                >
                    <div className="w-8 h-1 bg-blue-300 rounded-full"></div> {/* Simple visual handle indicator */}
                </div>
            </div>

            <p className="text-gray-500 mt-auto">Made with ❤️ using React & Tailwind CSS</p>
        </div>
    );
};

export default App;
