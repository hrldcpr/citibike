CURRENT="$2/temp-current.json"
NEXT="$2/temp-next.json"

curl $1 > $NEXT

touch $CURRENT
DIFF=$(diff -q $CURRENT $NEXT)
if [ "$DIFF" != "" ]
then
    F="$2/$(date +%s).json.gz"
    echo "saving $F"
    gzip < $NEXT > $F
    mv $NEXT $CURRENT
else
    echo "no change"
fi
