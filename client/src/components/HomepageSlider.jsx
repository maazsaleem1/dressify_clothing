import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSliders } from '../services/api';

const HomepageSlider = () => {
  const [sliders, setSliders] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSliders();
  }, []);

  // Auto-rotate slider
  useEffect(() => {
    if (sliders.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliders.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [sliders.length]);

  const fetchSliders = async () => {
    try {
      setLoading(true);
      const response = await getSliders();
      // Filter only active sliders
      const activeSliders = response.data.filter(slider => slider.status === true);
      setSliders(activeSliders);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + sliders.length) % sliders.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sliders.length);
  };

  if (loading) {
    return (
      <div className="w-full h-96 bg-gray-200 animate-pulse flex items-center justify-center">
        <div className="text-gray-400">Loading slider...</div>
      </div>
    );
  }

  if (sliders.length === 0) {
    return null; // Don't show slider if no active items
  }

  const currentSlider = sliders[currentIndex] || sliders[0];

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden rounded-xl shadow-2xl">
      {/* Slider Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: currentSlider?.imageUrl
            ? `url(${currentSlider.imageUrl})`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center text-white px-4 md:px-8 max-w-4xl">
            {currentSlider?.heading && (
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 animate-fade-in drop-shadow-lg">
                {currentSlider.heading}
              </h1>
            )}
            {currentSlider?.subheading && (
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 md:mb-8 text-gray-100 animate-fade-in-delay drop-shadow-md">
                {currentSlider.subheading}
              </p>
            )}
            {currentSlider?.ctaText && (
              <a
                href={currentSlider.ctaLink || '#'}
                onClick={(e) => {
                  if (!currentSlider.ctaLink || currentSlider.ctaLink === '#') {
                    e.preventDefault();
                  }
                }}
                className="inline-block bg-white text-primary-600 px-6 py-2.5 md:px-8 md:py-3 rounded-lg font-semibold text-base md:text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg animate-fade-in-delay-2"
              >
                {currentSlider.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {sliders.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 md:p-3 rounded-full transition-all backdrop-blur-sm"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} className="md:w-6 md:h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 md:p-3 rounded-full transition-all backdrop-blur-sm"
            aria-label="Next slide"
          >
            <ChevronRight size={20} className="md:w-6 md:h-6" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {sliders.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
          {sliders.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 md:h-3 rounded-full transition-all ${index === currentIndex
                ? 'bg-white w-6 md:w-8'
                : 'bg-white bg-opacity-50 hover:bg-opacity-75 w-2 md:w-3'
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomepageSlider;
