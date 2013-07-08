import Codec.Compression.GZip (decompress)
import qualified Data.ByteString.Lazy as LBS
import Data.ByteString.Lazy.Char8 (unpack)

import Control.Monad
import Data.List
import System.Directory
import System.Environment
import Text.JSON

readGZipFile :: FilePath -> IO String
readGZipFile path = fmap (unpack . decompress) $ LBS.readFile path

getStation :: Int -> Result (JSObject JSValue) -> Result (JSObject JSValue)
getStation stationId json = do
  json <- json
  stations <- valFromObj "results" json
  let [station] = filter (\s -> (valFromObj "id" s) == Ok stationId) stations
  return station

printStation :: Int -> [FilePath] -> IO ()
printStation stationId paths = go paths 0 0
  where
    go :: [FilePath] -> Int -> Int -> IO ()
    go [] _ _ = return ()
    go (path:paths) bikes0 docks0 = do
      json <- readGZipFile path
      let Ok station = getStation stationId (decode json)
          Ok bikes = valFromObj "availableBikes" station
          Ok docks = valFromObj "availableDocks" station
      unless (bikes == bikes0 && docks == docks0) $ putStrLn (show (path, bikes, docks))
      go paths bikes docks

main :: IO ()
main = do
  [stationId, start, end] <- getArgs
  setCurrentDirectory "stations2"
  paths <- getDirectoryContents "."
  printStation (read stationId) (sort (filter (\p -> p >= start && p <= end) paths))
