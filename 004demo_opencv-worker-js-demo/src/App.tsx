import './App.css';
import {OpenCVWorkerManager, generateOpenCVDefaultConfig, OpenCVConfig, generateDefaultOpenCVParams, OpenCVFunctionType } from '@dannadori/opencv-worker-js'
import DemoBase, { ControllerUIProp } from './DemoBase';

class App extends DemoBase {
  manager:OpenCVWorkerManager = new OpenCVWorkerManager()

  config:OpenCVConfig = generateOpenCVDefaultConfig()
  params = generateDefaultOpenCVParams()

  IMAGE_PATH = "./yuka_kawamura.jpg"
  RESULT_OVERLAY = true


  getCustomMenu = () => {
    const menu: ControllerUIProp[] = [
      {
        title: "processOnLocal",
        currentIndexOrValue: 1,
        values: ["on", "off"],
        callback: (val: string | number | MediaStream) => { },
      },
      {
        title: "reload model",
        currentIndexOrValue: 0,
        callback: (val: string | number | MediaStream) => {
          const processOnLocal = this.controllerRef.current!.getCurrentValue("processOnLocal")
          this.config.processOnLocal     = (processOnLocal === "on" ? true  : false) as boolean
          this.requireReload()
        },
      },
      {
        title: "function",
        currentIndexOrValue: 0,
        values: ["Canny"],
        callback: (val: string | number | MediaStream) => {
          this.params.type = OpenCVFunctionType.Canny
        },
      },
      {
        title: "threshold1",
        currentIndexOrValue: 50,
        range: [10,100,10],
        callback: (val: string | number | MediaStream) => {
          this.params.cannyParams!.threshold1 = val as number
        },
      },
      {
        title: "threshold2",
        currentIndexOrValue: 50,
        range: [10,100,10],
        callback: (val: string | number | MediaStream) => {
          this.params.cannyParams!.threshold2 = val as number
        },
      },
      {
        title: "apertureSize",
        currentIndexOrValue: 3,
        range: [1,7,2],
        callback: (val: string | number | MediaStream) => {
          this.params.cannyParams!.apertureSize = val as number
        },
      },
      {
        title: "L2gradient",
        currentIndexOrValue: 1,
        values: ["on","off"],
        callback: (val: string | number | MediaStream) => {
          if(val === "on"){
            this.params.cannyParams!.L2gradient = true
          }else{
            this.params.cannyParams!.L2gradient = false
          }
        },
      },
      {
        title: "ProcessWidth",
        currentIndexOrValue: 300,
        range: [300, 1024, 10],
        callback: (val: string | number | MediaStream) => {
          this.params.processWidth = val as number
        },
      },
      {
        title: "ProcessHeight",
        currentIndexOrValue: 300,
        range: [300, 1024, 10],
        callback: (val: string | number | MediaStream) => {
          this.params.processHeight = val as number
        },
      }
    ]
    return menu
  }

  
  handleResult = (prediction: any) => {
    const ctx = this.resultCanvasRef.current!.getContext("2d")!
    ctx.drawImage(prediction, 0, 0, this.resultCanvasRef.current!.width, this.resultCanvasRef.current!.height)
  }
}


export default App;
