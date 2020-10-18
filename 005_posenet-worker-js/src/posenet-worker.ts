import { PoseNetConfig, ModelConfigMobileNetV1, ModelConfigResNet50, WorkerCommand, 
    WorkerResponse, PoseNetFunctionType, PoseNetOperatipnParams} from './const'
import { getBrowserType, BrowserType} from './BrowserUtil'
import * as poseNet from '@tensorflow-models/posenet'

export {Pose, getAdjacentKeyPoints}  from '@tensorflow-models/posenet'
export {ModelConfigResNet50, ModelConfigMobileNetV1, PoseNetOperatipnParams, PoseNetFunctionType} from './const'

export const generatePoseNetDefaultConfig = ():PoseNetConfig => {
    const defaultConf:PoseNetConfig = {
        browserType         : getBrowserType(),
        model               : ModelConfigResNet50,
        processOnLocal      : false
    }
    return defaultConf
}

export const generateDefaultPoseNetParams = () =>{
    const defaultParams: PoseNetOperatipnParams = {
        type: PoseNetFunctionType.SinglePerson,
        singlePersonParams: {
            flipHorizontal: false
        },
        multiPersonParams: {
            flipHorizontal: false,
            maxDetections: 5,
            scoreThreshold: 0.5,
            nmsRadius: 20,
        },
    }
    return defaultParams
}



class LocalPN {
    model: poseNet.PoseNet | null = null
    canvas: HTMLCanvasElement = document.createElement("canvas")
    init = (config: PoseNetConfig) => {
        return poseNet.load(config.model).then(res => {
            console.log("posenet loaded locally", config)
            this.model = res
            return
        })
    }


    predict = async (canvas: HTMLCanvasElement, config:PoseNetConfig, params:PoseNetOperatipnParams):Promise<poseNet.Pose[]> => {
        // ImageData作成
        //// input resolutionにリサイズするのでここでのリサイズは不要
        // const processWidth = (config.processWidth <= 0 || config.processHeight <= 0) ? image.width : config.processWidth
        // const processHeight = (config.processWidth <= 0 || config.processHeight <= 0) ? image.height : config.processHeight
        const processWidth = canvas.width
        const processHeight = canvas.height

        //console.log("process image size:", processWidth, processHeight)
        this.canvas.width = processWidth
        this.canvas.height = processHeight
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(canvas, 0, 0, processWidth, processHeight)
        const newImg = ctx.getImageData(0, 0, processWidth, processHeight)
      

        if(params.type === PoseNetFunctionType.SinglePerson){
            const prediction = await this.model!.estimateSinglePose(newImg, params.singlePersonParams!)
            return [prediction]
        }else if(params.type === PoseNetFunctionType.MultiPerson){
            const prediction = await this.model!.estimateMultiplePoses(newImg, params.multiPersonParams!)
            return prediction
        }else{ // multi に倒す
            const prediction = await this.model!.estimateMultiplePoses(newImg, params.multiPersonParams!)
            return prediction
        }        
      }
}



export class PoseNetWorkerManager {
    private workerPN: Worker | null = null

    private config:PoseNetConfig = generatePoseNetDefaultConfig()
    private localPN = new LocalPN()
    init(config:PoseNetConfig|null = null) {
        if(config != null){
            this.config = config
        }
        if(this.workerPN){
            this.workerPN.terminate()
        }

        if(this.config.browserType === BrowserType.SAFARI||this.config.processOnLocal===true){
            // safariはwebworkerでWebGLが使えないのでworkerは使わない。
            return new Promise((onResolve, onFail) => {
                this.localPN.init(this.config!).then(() => {
                    onResolve()
                })
            })
        }
        
        // safari以外はworkerで処理
        this.workerPN = new Worker('./workerPN.ts', { type: 'module' })
        this.workerPN!.postMessage({ message: WorkerCommand.INITIALIZE, config: this.config })
        const p = new Promise((onResolve, onFail) => {
            this.workerPN!.onmessage = (event) => {
                if (event.data.message === WorkerResponse.INITIALIZED) {
                    console.log("WORKERSS INITIALIZED")
                    onResolve()
                } else {
                    console.log("Bodypix Initialization something wrong..")
                    onFail(event)
                }
            }
        })
        return p
    }

    predict(targetCanvas: HTMLCanvasElement, params:PoseNetOperatipnParams = generateDefaultPoseNetParams()) {
        if(this.config.browserType === BrowserType.SAFARI||this.config.processOnLocal===true){
                const p = new Promise(async (onResolve: (v: poseNet.Pose[]) => void, onFail) => {
                    const prediction = await this.localPN.predict(targetCanvas, this.config, params)
                    onResolve(prediction)
                })
                return p
        }else{
            const offscreen = new OffscreenCanvas(targetCanvas.width, targetCanvas.height)
            const offctx = offscreen.getContext("2d")!
            offctx.drawImage(targetCanvas, 0, 0, targetCanvas.width, targetCanvas.height)
            const imageBitmap = offscreen.transferToImageBitmap()
            const uid = performance.now()

            // This code work with mobilenet but too slow(about 1sec) (ofcourse faster than cpu-backend(about10sec))
            // And with resenet, doesn't work(maxpooling not support?).
            // So currently I don't intent this code.  ( also (*1)line)
            const imageData = targetCanvas.getContext("2d")!.getImageData(0, 0, targetCanvas.width, targetCanvas.height)
            this.workerPN!.postMessage({
                message: WorkerCommand.PREDICT, uid: uid,
                image: imageBitmap,
                //data:imageData!.data, width:imageData!.width, height:imageData!.height, // (*1)
                config:this.config, params:params
            }, [imageBitmap])
            //}, [imageData.data.buffer]) // (*1)
            const p = new Promise((onResolve: (v: poseNet.Pose[]) => void, onFail) => {
                this.workerPN!.onmessage = (event) => {
                    if (event.data.message === WorkerResponse.PREDICTED && event.data.uid === uid) {
                        onResolve(event.data.prediction)
                    } else {
                        console.log("Bodypix Prediction something wrong..")
                        onFail(event)
                    }
                }
            })
            return p
        }
    }
}
