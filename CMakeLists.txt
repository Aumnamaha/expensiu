# CMake configuration for MLC LLM model download on device
# This file is included in native build process when building ML models

cmake_minimum_required(VERSION 3.10)
project(MLCModels)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# MLC LLM model path
set(MLC_MODEL_PATH ${CMAKE_SOURCE_DIR}/lib/mlc-chat)

# Include directories for common libraries
include_directories(${CMAKE_SOURCE_DIR}/third_party/dmlc/include)

# Main executable for model management
add_executable(mlc-model-manager
    src/model_manager.cpp
)

target_include_directories(mlc-model-manager PRIVATE ${CMAKE_SOURCE_DIR}/src)

install(TARGETS mlc-model-manager DESTINATION bin)
